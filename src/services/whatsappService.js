const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestWaWebVersion,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");
const env = require("../config/env");
const logger = require("../utils/logger");
const messageController = require("../controllers/messageController");

const sessionsRoot = path.resolve(__dirname, "..", "..", "sessions");

if (!fs.existsSync(sessionsRoot)) {
  fs.mkdirSync(sessionsRoot, { recursive: true });
}

async function startWhatsapp() {
  const instanceId = env.tenantId || "default";
  const authPath = path.join(sessionsRoot, instanceId);
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestWaWebVersion();

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: Browsers.ubuntu("Chrome"),
    version,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info("whatsappService", "QR Code atualizado, escaneie no WhatsApp");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      logger.info("whatsappService", "Conexao WhatsApp estabelecida");
    }
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      logger.warn("whatsappService", "Conexao encerrada", {
        shouldReconnect,
        statusCode: lastDisconnect?.error?.output?.statusCode,
        error: lastDisconnect?.error?.message,
      });
      if (shouldReconnect) {
        await startWhatsapp();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        await messageController.handleIncomingMessage(sock, msg);
      } catch (error) {
        logger.error("whatsappService", "Erro processando mensagem", error.message);
      }
    }
  });

  return sock;
}

module.exports = {
  startWhatsapp,
};
