const chatFlow = require("../flows/chatFlow");
const repos = require("../database/repositories");
const stateService = require("../services/stateService");
const logger = require("../utils/logger");
const env = require("../config/env");

const botSentMessageIds = new Set();

function extractText(message) {
  const content = message?.message;
  if (!content) return "";
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  return "";
}

async function handleIncomingMessage(sock, msg) {
  if (!msg?.key?.remoteJid) {
    return;
  }
  if (msg.key.fromMe && !env.allowSelfMessages) {
    return;
  }
  if (msg.key.fromMe && botSentMessageIds.has(msg.key.id)) {
    botSentMessageIds.delete(msg.key.id);
    return;
  }
  if (msg.key.remoteJid.endsWith("@g.us")) {
    return;
  }

  const phone = msg.key.remoteJid.replace("@s.whatsapp.net", "");
  const text = extractText(msg);
  if (!text) return;

  const user = stateService.getUser(phone);
  if (!user.name && text.split(" ").length <= 3 && !/\d/.test(text)) {
    stateService.setState(user, { name: text });
  }

  const reply = await chatFlow.handleChat({ phone, message: text });
  repos.saveMessage(user.id, "out", reply);

  logger.info("messageController", "Respondendo cliente", { phone, reply });
  const sent = await sock.sendMessage(msg.key.remoteJid, { text: reply });
  if (sent?.key?.id) {
    botSentMessageIds.add(sent.key.id);
  }
}

module.exports = {
  handleIncomingMessage,
};
