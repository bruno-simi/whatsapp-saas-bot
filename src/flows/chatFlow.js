const { STATES, GLOBAL_COMMANDS } = require("../utils/constants");
const { normalizeText } = require("../utils/text");
const intentService = require("../services/intentService");
const responseService = require("../services/responseService");
const stateService = require("../services/stateService");
const appointmentService = require("../services/appointmentService");
const businessSkills = require("../ai/skills/businessSkills");
const env = require("../config/env");
const repos = require("../database/repositories");
const logger = require("../utils/logger");

function isCommand(text, command) {
  return normalizeText(text) === command;
}

function formatSlots(slots) {
  if (!slots.length) {
    return "Nao encontrei horario livre nessa data. Quer tentar outro dia?";
  }
  const list = slots.slice(0, 4).map((slot, index) => `${index + 1}) ${slot.label}`).join("\n");
  return `Tenho estes horarios livres:\n${list}\n\nMe diga o numero da opcao.`;
}

function hasDateHint(normalizedText) {
  if (!normalizedText) return false;
  if (normalizedText.includes("amanha") || normalizedText.includes("hoje")) return true;
  return /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(normalizedText) || /\b\d{4}-\d{2}-\d{2}\b/.test(normalizedText);
}

function extractServiceFromText(text) {
  const normalized = normalizeText(text);
  const services = businessSkills.listServices(env.businessType) || [];
  return services.find((service) => normalized.includes(normalizeText(service))) || null;
}

function continuationPrompt(user) {
  if (user.state === STATES.AWAITING_SERVICE) {
    return "\n\nSe quiser, seguimos seu agendamento. Me diga qual servico voce quer.";
  }
  if (user.state === STATES.AWAITING_DATE) {
    return "\n\nSe quiser, seguimos seu agendamento. Me diga a data desejada.";
  }
  return "";
}

async function handleChat({ phone, message }) {
  let user = stateService.getUser(phone);
  const text = (message || "").trim();
  const normalized = normalizeText(text);
  const detectedService = extractServiceFromText(text);
  const dateHint = hasDateHint(normalized);
  repos.saveMessage(user.id, "in", text);

  logger.info("chatFlow", "Mensagem recebida", { phone, state: user.state, text });

  if (isCommand(text, GLOBAL_COMMANDS.CANCEL)) {
    user = stateService.setState(user, {
      state: STATES.IDLE,
      current_service: null,
      current_date_text: null,
      current_slot: null,
    });
    return "Tudo certo, fluxo cancelado. Se quiser, posso te mostrar o menu com *menu*.";
  }

  if (isCommand(text, GLOBAL_COMMANDS.MENU)) {
    user = stateService.setState(user, { state: STATES.IDLE });
    return responseService.fallbackMenu();
  }

  const intent = intentService.detectIntent(text);
  logger.info("chatFlow", "Intencao detectada", { phone, intent });

  if (intent === "services" && user.state !== STATES.AWAITING_CONFIRMATION) {
    return `${responseService.servicesMessage()}${continuationPrompt(user)}`;
  }

  if (intent === "price" && user.state !== STATES.AWAITING_CONFIRMATION) {
    return `${responseService.priceMessage()}${continuationPrompt(user)}`;
  }

  if (user.state === STATES.AWAITING_SERVICE) {
    if (detectedService && dateHint) {
      const slots = await appointmentService.getSlots(text);
      if (!slots.length) {
        user = stateService.setState(user, {
          state: STATES.AWAITING_DATE,
          current_service: detectedService,
          current_date_text: text,
          current_slot: null,
        });
        return formatSlots(slots);
      }
      user = stateService.setState(user, {
        state: STATES.AWAITING_CONFIRMATION,
        current_service: detectedService,
        current_date_text: text,
        current_slot: JSON.stringify(slots.slice(0, 4)),
      });
      return formatSlots(slots);
    }

    user = stateService.setState(user, {
      state: STATES.AWAITING_DATE,
      current_service: detectedService || text,
    });
    return responseService.askDateMessage();
  }

  if (user.state === STATES.AWAITING_DATE) {
    if (detectedService && !user.current_service) {
      user = stateService.setState(user, { current_service: detectedService });
    }

    const slots = await appointmentService.getSlots(text);
    if (!slots.length) {
      user = stateService.setState(user, {
        state: STATES.AWAITING_DATE,
        current_date_text: text,
        current_slot: null,
      });
      return formatSlots(slots);
    }
    user = stateService.setState(user, {
      state: STATES.AWAITING_CONFIRMATION,
      current_date_text: text,
      current_slot: JSON.stringify(slots.slice(0, 4)),
    });
    return formatSlots(slots);
  }

  if (user.state === STATES.AWAITING_CONFIRMATION) {
    const slots = JSON.parse(user.current_slot || "[]");
    const choice = intentService.extractChoice(text, slots.length || 4);
    if (!choice || !slots[choice - 1]) {
      return responseService.slotChoiceRetryMessage();
    }
    const selectedSlot = slots[choice - 1];

    const result = await appointmentService.confirmAppointment({
      user,
      phone,
      service: user.current_service || "Servico nao informado",
      slot: selectedSlot,
      name: user.name || "Cliente",
    });

    user = stateService.setState(user, {
      state: STATES.IDLE,
      current_service: null,
      current_date_text: null,
      current_slot: null,
    });

    return `Fechado! Seu agendamento foi confirmado para ${selectedSlot.label}. Protocolo #${result.appointment.id}.`;
  }

  if (intent === "greeting") {
    return `${responseService.greetingMessage()}\n${responseService.fallbackMenu()}`;
  }

  if (intent === "services") {
    return responseService.servicesMessage();
  }

  if (intent === "price") {
    return responseService.priceMessage();
  }

  if (intent === "schedule") {
    if (detectedService && dateHint) {
      const slots = await appointmentService.getSlots(text);
      if (!slots.length) {
        stateService.setState(user, {
          state: STATES.AWAITING_DATE,
          current_service: detectedService,
          current_date_text: text,
          current_slot: null,
        });
        return formatSlots(slots);
      }
      stateService.setState(user, {
        state: STATES.AWAITING_CONFIRMATION,
        current_service: detectedService,
        current_date_text: text,
        current_slot: JSON.stringify(slots.slice(0, 4)),
      });
      return formatSlots(slots);
    }

    if (detectedService) {
      stateService.setState(user, {
        state: STATES.AWAITING_DATE,
        current_service: detectedService,
      });
      return responseService.askDateMessage();
    }

    stateService.setState(user, { state: STATES.AWAITING_SERVICE });
    return responseService.scheduleStartMessage();
  }

  const menuChoice = intentService.extractChoice(text, 3);

  if (menuChoice === 1) {
    stateService.setState(user, { state: STATES.AWAITING_SERVICE });
    return responseService.scheduleStartMessage();
  }
  if (menuChoice === 2) {
    return responseService.servicesMessage();
  }
  if (menuChoice === 3) {
    return responseService.priceMessage();
  }

  return responseService.fallbackMenu();
}

module.exports = {
  handleChat,
};
