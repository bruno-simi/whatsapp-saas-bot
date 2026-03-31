const env = require("../config/env");
const logger = require("../utils/logger");
const { applyRules } = require("./rules");
const { detectIntent, extractBasicEntities, handleFallback } = require("./skills/assistantSkills");
const { askGemini } = require("./geminiService");
const { STATES } = require("../utils/constants");

function shouldUseLegacy(intent) {
  return intent === "schedule" || intent === "services" || intent === "price";
}

function isFlowInProgress(state) {
  return state && state !== STATES.IDLE;
}

async function processMessage(message, context = {}) {
  const ruleResult = applyRules(message);
  if (ruleResult) {
    logger.info("decisionEngine", "Regra aplicada", { source: ruleResult.source, intent: ruleResult.intent });
    return ruleResult;
  }

  const quickIntent = detectIntent(message);
  const entities = extractBasicEntities(message);
  logger.info("decisionEngine", "Intencao local detectada", { intent: quickIntent, entities });

  if (isFlowInProgress(context.currentState)) {
    return {
      handled: false,
      useLegacyFlow: true,
      intent: quickIntent,
      source: "context:legacy_flow_in_progress",
    };
  }

  if (shouldUseLegacy(quickIntent)) {
    return {
      handled: false,
      useLegacyFlow: true,
      intent: quickIntent,
      source: "skills:intent",
    };
  }

  if (!env.useAi) {
    const fallback = handleFallback();
    return {
      handled: true,
      reply: fallback.response,
      intent: fallback.intent,
      action: "respond",
      source: "fallback:use_ai_false",
    };
  }

  logger.info("decisionEngine", "Chamando Gemini", {
    phone: context.phone,
    state: context.currentState,
  });
  const aiResult = await askGemini(message, context);
  logger.info("decisionEngine", "Resposta Gemini recebida", { intent: aiResult.intent });

  let action = "respond";
  if (aiResult.intent === "schedule" && (!aiResult.service || !aiResult.date)) {
    action = "ask_more_data";
  }
  if (aiResult.intent === "schedule" && aiResult.service && aiResult.date) {
    return {
      handled: false,
      useLegacyFlow: true,
      intent: aiResult.intent,
      source: "ai:handoff_legacy_schedule",
    };
  }

  return {
    handled: true,
    reply: aiResult.response || handleFallback().response,
    intent: aiResult.intent,
    action,
    source: "ai",
    data: {
      service: aiResult.service,
      date: aiResult.date,
      name: aiResult.name,
    },
  };
}

module.exports = {
  processMessage,
};
