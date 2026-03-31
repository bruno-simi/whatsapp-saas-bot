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
const repos = require("../database/repositories");

const sessionsRoot = path.resolve(__dirname, "..", "..", "sessions");
let isSessionLogSuppressed = false;

if (!fs.existsSync(sessionsRoot)) {
  fs.mkdirSync(sessionsRoot, { recursive: true });
}

function suppressVerboseSessionLog() {
  if (isSessionLogSuppressed) return;

  const originalConsoleLog = console.log;
  console.log = (...args) => {
    if (typeof args[0] === "string" && args[0].startsWith("Closing session:")) {
      return;
    }
    originalConsoleLog(...args);
  };
  isSessionLogSuppressed = true;
}

async function startWhatsapp() {
  suppressVerboseSessionLog();

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
      const rawPhone = (sock?.user?.id || "").split(":")[0] || "";
      const whatsappPhone = rawPhone.replace(/\D/g, "");
      const integration = whatsappPhone
        ? repos.getWhatsappIntegrationByPhone(whatsappPhone)
        : null;
      if (integration?.business_id) {
        env.tenantId = integration.business_id;
      }
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
