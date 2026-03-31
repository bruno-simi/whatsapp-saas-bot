const chatFlow = require("../flows/chatFlow");
const repos = require("../database/repositories");
const stateService = require("../services/stateService");
const logger = require("../utils/logger");
const env = require("../config/env");
const { updateContext } = require("../ai/contextStore");
const { processMessage } = require("../ai/decisionEngine");
const { buildAIContext } = require("../ai/buildAIContext");
const { STATES } = require("../utils/constants");

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

function extractFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function looksLikeName(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 60) return false;
  if (/\d/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;
  return words.every((word) => /^[A-Za-zÀ-ÖØ-öø-ÿ'-]+$/.test(word));
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
  const trimmedText = text.trim();

  if (env.tenantId === "consultorio-demo" && !user.name) {
    repos.saveMessage(user.id, "in", trimmedText);

    let reply = "Para iniciar seu atendimento, poderia me informar seu nome completo?";
    if (looksLikeName(trimmedText)) {
      const updatedUser = stateService.setState(user, { name: trimmedText });
      const shortName = extractFirstName(updatedUser.name);
      reply = `Perfeito, ${shortName}. Em que posso te ajudar hoje?`;
    }

    repos.saveMessage(user.id, "out", reply);
    logger.info("messageController", "Coleta inicial de nome", { phone, reply });
    const sent = await sock.sendMessage(msg.key.remoteJid, { text: reply });
    if (sent?.key?.id) {
      botSentMessageIds.add(sent.key.id);
    }
    return;
  }

  if (!user.name && text.split(" ").length <= 3 && !/\d/.test(text)) {
    stateService.setState(user, { name: text });
  }

  const aiContext = buildAIContext({ ...user, phone }, text);

  const decision = await processMessage(text, aiContext);
  logger.info("messageController", "Decisao da mensagem", {
    phone,
    source: decision.source,
    intent: decision.intent,
    action: decision.action || "none",
    useLegacyFlow: Boolean(decision.useLegacyFlow),
  });

  let reply = decision.reply;
  if (
    (decision.action === "suggest_slots" || decision.action === "suggest_next_slots")
    && Array.isArray(decision.data?.slots)
    && decision.data.slots.length
  ) {
    stateService.setState(user, {
      state: STATES.AWAITING_CONFIRMATION,
      current_service: decision.data.service || user.current_service || null,
      current_date_text: decision.data.date || user.current_date_text || null,
      current_slot: JSON.stringify(decision.data.slots),
    });
  }
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
