const { STATES, GLOBAL_COMMANDS } = require("../utils/constants");
const dayjs = require("dayjs");
const { normalizeText } = require("../utils/text");
const intentService = require("../services/intentService");
const responseService = require("../services/responseService");
const stateService = require("../services/stateService");
const appointmentService = require("../services/appointmentService");
const businessSkills = require("../ai/skills/businessSkills");
const env = require("../config/env");
const repos = require("../database/repositories");
const logger = require("../utils/logger");
const { hasDateHint } = require("../utils/dateParser");

function isConsultorioFlow() {
  return (
    env.businessType === "consultorio"
    || env.configTenantId === "consultorio-demo"
    || env.tenantId === "consultorio-demo"
  );
}

function isCommand(text, command) {
  return normalizeText(text) === command;
}

function formatSlots(slots) {
  if (!slots.length) {
    return responseService.generateHumanResponse("no_slots");
  }
  return responseService.generateHumanResponse("slots_list", {}, { slots });
}

async function consultorioNextSlotsForService(serviceName) {
  const nextSlots = await appointmentService.getNextAvailableSlots(dayjs().format("YYYY-MM-DD 09:00"), {
    daysToSearch: 7,
    maxSlots: 4,
    serviceName,
  });
  return nextSlots;
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
  const detectedService = businessSkills.matchServiceFromText(text);
  const dateHint = hasDateHint(text);
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
    return responseService.fallbackMenu(user.name);
  }

  if (
    normalized === "voltar"
    && (user.state === STATES.AWAITING_DATE || user.state === STATES.AWAITING_CONFIRMATION)
  ) {
    user = stateService.setState(user, {
      state: STATES.AWAITING_SERVICE,
      current_service: null,
      current_date_text: null,
      current_slot: null,
    });
    return `${responseService.scheduleStartMessage(user.name)}\n\nSe preferir, digite a especialidade correta.`;
  }

  const intent = intentService.detectIntent(text);
  logger.info("chatFlow", "Intencao detectada", { phone, intent });

  if (intent === "services" && user.state !== STATES.AWAITING_CONFIRMATION) {
    return `${responseService.servicesMessage(user.name)}${continuationPrompt(user)}`;
  }

  if (intent === "price" && user.state !== STATES.AWAITING_CONFIRMATION) {
    return `${responseService.priceMessage(user.name)}${continuationPrompt(user)}`;
  }

  if (user.state === STATES.AWAITING_SERVICE) {
    if (detectedService && dateHint) {
      const slots = await appointmentService.getSlots(text, { serviceName: detectedService });
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

    if (!detectedService) {
      user = stateService.setState(user, {
        state: STATES.AWAITING_SERVICE,
        current_service: null,
      });
      return responseService.scheduleStartMessage(user.name);
    }

    user = stateService.setState(user, {
      state: STATES.AWAITING_DATE,
      current_service: detectedService,
    });
    if (isConsultorioFlow()) {
      const nextSlots = await consultorioNextSlotsForService(detectedService);
      if (!nextSlots.length) {
        return responseService.generateHumanResponse("no_slots", { name: user.name });
      }
      user = stateService.setState(user, {
        state: STATES.AWAITING_CONFIRMATION,
        current_service: detectedService,
        current_date_text: dayjs().format("YYYY-MM-DD 09:00"),
        current_slot: JSON.stringify(nextSlots.slice(0, 4)),
      });
      return responseService.generateHumanResponse("slots_list", { name: user.name }, { slots: nextSlots });
    }
    return responseService.askDateMessage(user.name);
  }

  if (user.state === STATES.AWAITING_DATE) {
    if (!user.current_service || hasDateHint(user.current_service)) {
      user = stateService.setState(user, {
        state: STATES.AWAITING_SERVICE,
        current_service: null,
        current_slot: null,
      });
      return responseService.scheduleStartMessage(user.name);
    }

    if (detectedService && !user.current_service) {
      user = stateService.setState(user, { current_service: detectedService });
    }

    if (!dateHint) {
      return responseService.askDateMessage(user.name);
    }

    const slots = await appointmentService.getSlots(text, {
      serviceName: user.current_service || undefined,
    });
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
    if (!slots.length) {
      if (detectedService) {
        user = stateService.setState(user, {
          state: STATES.AWAITING_DATE,
          current_service: detectedService,
        });
        return responseService.askDateMessage(user.name);
      }
      user = stateService.setState(user, {
        state: STATES.AWAITING_DATE,
        current_slot: null,
      });
      return responseService.askDateMessage(user.name);
    }

    const choiceEarly = intentService.extractChoice(text, slots.length || 4);
    if (
      intent === "schedule" &&
      !dateHint &&
      (!choiceEarly || !slots[choiceEarly - 1])
    ) {
      if (detectedService) {
        user = stateService.setState(user, {
          state: STATES.AWAITING_DATE,
          current_service: detectedService,
          current_date_text: null,
          current_slot: null,
        });
        return responseService.askDateMessage(user.name);
      }
      user = stateService.setState(user, {
        state: STATES.AWAITING_SERVICE,
        current_service: null,
        current_date_text: null,
        current_slot: null,
      });
      return responseService.scheduleStartMessage(user.name);
    }

    if (dateHint && intent === "schedule") {
      const mergedText = [user.current_service, text].filter(Boolean).join(" ");
      const slotsNew = await appointmentService.getSlots(mergedText || text, {
        serviceName: user.current_service || undefined,
      });
      if (!slotsNew.length) {
        user = stateService.setState(user, {
          state: STATES.AWAITING_DATE,
          current_date_text: mergedText || text,
          current_slot: null,
        });
        return formatSlots(slotsNew);
      }
      user = stateService.setState(user, {
        state: STATES.AWAITING_CONFIRMATION,
        current_date_text: mergedText || text,
        current_slot: JSON.stringify(slotsNew.slice(0, 4)),
      });
      return formatSlots(slotsNew);
    }
    const choice = intentService.extractChoice(text, slots.length || 4);
    if (!choice || !slots[choice - 1]) {
      if (
        slots.length &&
        (intent === "schedule" || intent === "greeting" || intent === "unknown")
      ) {
        return responseService.generateHumanResponse("slots_reminder", {}, { slots });
      }
      return responseService.slotChoiceRetryMessage(user.name);
    }
    const selectedSlot = slots[choice - 1];
    let result;
    try {
      result = await appointmentService.confirmAppointment({
        user,
        phone,
        service: user.current_service || "Servico nao informado",
        slot: selectedSlot,
        name: user.name || "Cliente",
      });
    } catch (error) {
      if (error?.code === "SLOT_UNAVAILABLE") {
        const refreshedSlots = await appointmentService.getSlots(
          user.current_date_text || selectedSlot.start,
          { serviceName: user.current_service || undefined }
        );
        user = stateService.setState(user, {
          state: STATES.AWAITING_CONFIRMATION,
          current_slot: JSON.stringify(refreshedSlots.slice(0, 4)),
        });
        const stillAvailable = refreshedSlots.some(
          (slot) =>
            dayjs(slot.start).valueOf() === dayjs(selectedSlot.start).valueOf()
            && dayjs(slot.end).valueOf() === dayjs(selectedSlot.end).valueOf()
        );
        if (stillAvailable) {
          return responseService.generateHumanResponse("slots_reminder", { name: user.name }, { slots: refreshedSlots });
        }
        return responseService.generateHumanResponse("slot_unavailable", { name: user.name }, { slots: refreshedSlots });
      }
      throw error;
    }

    user = stateService.setState(user, {
      state: STATES.IDLE,
      current_service: null,
      current_date_text: null,
      current_slot: null,
    });

    return `${user.name ? `${user.name}, ` : ""}Fechado! Seu agendamento foi confirmado para ${selectedSlot.label}. Protocolo #${result.appointment.id}.`;
  }

  if (intent === "greeting") {
    return `${responseService.greetingMessage(user.name)}\n${responseService.fallbackMenu(user.name)}`;
  }

  if (intent === "services") {
    return responseService.servicesMessage(user.name);
  }

  if (intent === "price") {
    return responseService.priceMessage(user.name);
  }

  if (intent === "schedule") {
    if (detectedService && dateHint) {
      const slots = await appointmentService.getSlots(text, { serviceName: detectedService });
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
      if (isConsultorioFlow()) {
        const nextSlots = await consultorioNextSlotsForService(detectedService);
        if (!nextSlots.length) {
          return responseService.generateHumanResponse("no_slots", { name: user.name });
        }
        stateService.setState(user, {
          state: STATES.AWAITING_CONFIRMATION,
          current_service: detectedService,
          current_date_text: dayjs().format("YYYY-MM-DD 09:00"),
          current_slot: JSON.stringify(nextSlots.slice(0, 4)),
        });
        return responseService.generateHumanResponse("slots_list", { name: user.name }, { slots: nextSlots });
      }
      return responseService.askDateMessage(user.name);
    }

    stateService.setState(user, { state: STATES.AWAITING_SERVICE });
    return responseService.scheduleStartMessage(user.name);
  }

  const menuChoice = intentService.extractChoice(text, 3);

  if (menuChoice === 1) {
    stateService.setState(user, { state: STATES.AWAITING_SERVICE });
    return responseService.scheduleStartMessage(user.name);
  }
  if (menuChoice === 2) {
    return responseService.servicesMessage(user.name);
  }
  if (menuChoice === 3) {
    return responseService.priceMessage(user.name);
  }

  return responseService.fallbackMenu(user.name);
}

module.exports = {
  handleChat,
};
