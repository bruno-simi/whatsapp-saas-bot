const chatFlow = require("../flows/chatFlow");
const repos = require("../database/repositories");
const stateService = require("../services/stateService");
const logger = require("../utils/logger");
const env = require("../config/env");
const { getContext, updateContext } = require("../ai/contextStore");
const { processMessage } = require("../ai/decisionEngine");

const botSentMessageIds = new Set();
const processedIncomingMessageIds = new Set();

function registerIncomingMessageId(messageId) {
  if (!messageId) return true;
  if (processedIncomingMessageIds.has(messageId)) return false;
  processedIncomingMessageIds.add(messageId);
  if (processedIncomingMessageIds.size > 2000) {
    const first = processedIncomingMessageIds.values().next().value;
    processedIncomingMessageIds.delete(first);
  }
  return true;
}

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
  if (!registerIncomingMessageId(msg.key.id)) {
    return;
  }

  const phone = msg.key.remoteJid.replace("@s.whatsapp.net", "");
  const text = extractText(msg);
  if (!text) return;

  const user = stateService.getUser(phone);
  if (!user.name && text.split(" ").length <= 3 && !/\d/.test(text)) {
    stateService.setState(user, { name: text });
  }

  const memoryContext = getContext(phone);
  const aiContext = {
    ...memoryContext,
    phone,
    businessType: env.businessType,
    currentState: user.state,
    lastMessages: [...(memoryContext.lastMessages || []), text].slice(-6),
    collectedData: {
      ...(memoryContext.collectedData || {}),
      name: user.name || null,
    },
  };

  const decision = await processMessage(text, aiContext);
  logger.info("messageController", "Decisao da mensagem", {
    phone,
    source: decision.source,
    intent: decision.intent,
    action: decision.action || "none",
    useLegacyFlow: Boolean(decision.useLegacyFlow),
  });

  let reply = decision.reply;
  if (!decision.handled || decision.useLegacyFlow || !reply) {
    reply = await chatFlow.handleChat({ phone, message: text });
  }

  const latestUser = stateService.getUser(phone);
  updateContext(phone, {
    currentState: latestUser.state,
    lastIntent: decision.intent || "unknown",
    collectedData: decision.data || {},
    lastMessages: [...(aiContext.lastMessages || []), reply].slice(-6),
  });

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
