const env = require("../config/env");
const logger = require("../utils/logger");
const { applyRules } = require("./rules");
const { detectIntent, extractBasicEntities, handleFallback } = require("./skills/assistantSkills");
const { interpretMessageAdvanced } = require("./geminiService");
const { STATES } = require("../utils/constants");
const appointmentService = require("../services/appointmentService");
const businessSkills = require("./skills/businessSkills");
const { parseDateText, hasDateHint } = require("../utils/dateParser");
const { normalizeText } = require("../utils/text");
const intentService = require("../services/intentService");

function shouldUseLegacy(intent) {
  return intent === "services" || intent === "price";
}

function isFlowInProgress(state) {
  return state && state !== STATES.IDLE;
}

function formatSlots(slots) {
  if (!slots.length) {
    return "Poxa, nessa data nao encontrei nenhum horario livre — entendo que cansa. Quer tentar outro dia ou outro periodo (manha/tarde)? Estou aqui pra ajudar.";
  }
  const list = slots.slice(0, 4).map((slot, index) => `${index + 1}) ${slot.label}`).join("\n");
  return `Encontrei estes horarios livres pra voce:\n${list}\n\nQual fica melhor? Pode responder com o numero (1 a 4).`;
}

async function processMessage(message, context = {}) {
  const normalized = normalizeText(message || "");
  const flowState = context.currentState;
  if (
    isFlowInProgress(flowState)
    && /^\s*([1-9])\s*$/.test(normalized)
    && (flowState === STATES.AWAITING_CONFIRMATION || flowState === STATES.AWAITING_SERVICE)
  ) {
    return {
      handled: false,
      useLegacyFlow: true,
      intent: intentService.detectIntent(message),
      source: "context:numeric_pick_in_flow",
    };
  }

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
    if (quickIntent === "schedule" || quickIntent === "services" || quickIntent === "price") {
      return {
        handled: false,
        useLegacyFlow: true,
        intent: quickIntent,
        source: "fallback:legacy_without_ai",
      };
    }
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
    hasHistory: Boolean(context.customerHistory?.lastService),
  });
  const aiResult = await interpretMessageAdvanced(message, context);
  logger.info("decisionEngine", "Resposta Gemini recebida", { intent: aiResult.intent });

  if (aiResult.intent === "schedule" && aiResult.service && !aiResult.date && hasDateHint(message)) {
    aiResult.date = await parseDateText(message);
  }

  let action = "respond";
  if (aiResult.intent === "schedule" && (!aiResult.service || !aiResult.date)) {
    action = "ask_more_data";
  }
  if (aiResult.intent === "schedule" && aiResult.service && aiResult.date) {
    if (!hasDateHint(message)) {
      logger.info("decisionEngine", "Data ignorada: cliente nao citou dia na mensagem; fluxo legacy pede a data");
      return {
        handled: false,
        useLegacyFlow: true,
        intent: quickIntent,
        source: "ai:inherit_schedule_without_explicit_date",
      };
    }
    const serviceFromText = businessSkills.matchServiceFromText(message);
    if (!serviceFromText && context.currentState === STATES.IDLE) {
      logger.info("decisionEngine", "Agenda: sem servico explicitado na mensagem; fluxo legacy");
      return {
        handled: false,
        useLegacyFlow: true,
        intent: quickIntent,
        source: "ai:schedule_need_service_in_message",
      };
    }
    const suggestedSlots = await appointmentService.getSlots(aiResult.date, {
      serviceName: aiResult.service,
    });
    if (suggestedSlots.length) {
      return {
        handled: true,
        intent: aiResult.intent,
        action: "suggest_slots",
        source: "ai:suggest_slots",
        reply: formatSlots(suggestedSlots),
        data: {
          service: aiResult.service,
          date: aiResult.date,
          slots: suggestedSlots.slice(0, 4),
        },
      };
    }
    const nextSlots = await appointmentService.getNextAvailableSlots(aiResult.date, {
      daysToSearch: 5,
      maxSlots: 4,
      serviceName: aiResult.service,
    });
    if (nextSlots.length) {
      return {
        handled: true,
        intent: aiResult.intent,
        action: "suggest_next_slots",
        source: "ai:suggest_next_slots",
        reply: `Nao achei vaga exatamente nessa data, mas achei opcoes bem pertinho nos proximos dias:\n${nextSlots
          .map((slot, index) => `${index + 1}) ${slot.label}`)
          .join("\n")}\n\nSe alguma servir, me diga o numero.`,
        data: {
          service: aiResult.service,
          date: aiResult.date,
          slots: nextSlots,
        },
      };
    }
    return {
      handled: false,
      useLegacyFlow: true,
      intent: aiResult.intent,
      source: "ai:handoff_legacy_schedule",
      data: {
        service: aiResult.service,
        date: aiResult.date,
      },
    };
  }

  if (
    aiResult.intent === "schedule" &&
    !aiResult.service &&
    context.customerHistory?.lastService
  ) {
    return {
      handled: true,
      intent: "schedule",
      action: "suggest_repeat_service",
      source: "ai:customer_memory",
      reply: `Quer fazer o mesmo servico da ultima vez (${context.customerHistory.lastService})?`,
      data: {
        service: context.customerHistory.lastService,
      },
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
