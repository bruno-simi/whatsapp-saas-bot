const env = require("../config/env");
const businessSkills = require("../ai/skills/businessSkills");

const responses = {
  barbearia: {
    greeting: ["Fala, meu querido! Como posso te ajudar hoje?", "Opa! Bora cuidar do visual?"],
    services: ["Aqui temos: corte, barba e combo corte+barba.", "Trabalhamos com corte, barba e combo."],
    price: ["Corte a partir de R$ 35, barba R$ 25 e combo R$ 55.", "Valores: corte R$ 35+, barba R$ 25 e combo R$ 55."],
  },
  oficina: {
    greeting: ["Ola! Me diz como posso ajudar com seu veiculo.", "Bem-vindo! Qual servico voce precisa na oficina?"],
    services: ["Fazemos revisao, troca de oleo e diagnostico.", "Servicos principais: revisao, troca de oleo, diagnostico."],
    price: ["Os valores variam por modelo e servico, te passo uma estimativa.", "Posso te passar valor aproximado apos identificar o servico."],
  },
  consultorio: {
    greeting: ["Ola, seja muito bem-vindo(a). Em que posso te ajudar hoje?"],
    services: ["Atendemos consultas medicas, odontologicas e esteticos.", "Realizamos atendimentos em consulta e procedimentos esteticos."],
    price: ["Os valores dependem do procedimento. Posso te orientar.", "Consigo informar faixa de valor conforme o tipo de consulta."],
  },
};

const humanResponses = {
  no_slots: [
    "Hoje ta bem cheio 😅, mas a gente consegue sim. Quer tentar outro dia ou outro periodo (manha/tarde)?",
    "Nao achei vaga nesse recorte agora 😬. Se voce quiser, te mostro opcoes de outro dia rapidinho.",
  ],
  slots_found: [
    "Separei alguns horarios livres pra voce:",
    "Boa! Encontrei estes horarios disponiveis:",
  ],
  ask_slot_choice: [
    "Qual voce prefere? Pode me mandar o numero (1 a 4).",
    "Me diz qual ficou melhor pra voce, so com o numero (1 a 4).",
  ],
  slots_reminder: [
    "Claro! Estes sao os horarios que separei — e so responder com o numero:",
    "Sem problema. Deixo aqui de novo as opcoes; escolhe o numero que preferir:",
  ],
  invalid_slot_choice: [
    "Acho que nao peguei essa opcao 🤔. Pode me dizer o numero do horario que voce quer (1 a 4)?",
    "Quase! Pra eu reservar certinho, me manda so o numero da opcao (1 a 4), por favor.",
  ],
  slot_unavailable: [
    "Esse horario acabou de ser preenchido 😕, acontece as vezes. Te mostro outras opcoes agora:",
    "Poxa, esse horario saiu agora ha pouco. Mas relaxa, ja te mando outras opcoes:",
  ],
  ask_date: [
    "Perfeito! Qual data voce prefere? Pode me dizer o dia que voce quer.",
    "Boa! Me conta a data que fica melhor pra voce (ex: amanha ou na proxima semana).",
  ],
  ask_service: [
    "Perfeito, vamos marcar 😊 Qual servico voce quer?",
    "Fechou! Me diz qual servico voce quer agendar.",
  ],
  missing_info: [
    "Pra eu te ajudar melhor, so me conta {field}.",
    "Me passa {field} e eu ja sigo com voce por aqui.",
  ],
};

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function firstName(name) {
  if (!name) return null;
  const clean = String(name).trim();
  if (!clean) return null;
  return clean.split(/\s+/)[0];
}

function isConsultorioDemoTenant() {
  return env.configTenantId === "consultorio-demo" || env.tenantId === "consultorio-demo";
}

function withCustomerName(text, name) {
  if (!isConsultorioDemoTenant() && env.businessType !== "consultorio") return text;
  const shortName = firstName(name);
  if (!shortName) return text;
  return `${shortName}, ${text}`;
}

function currentProfile() {
  return responses[env.businessType] || responses.barbearia;
}

function greetingMessage(name) {
  return withCustomerName(pick(currentProfile().greeting), name);
}

function servicesMessage(name) {
  return withCustomerName(pick(currentProfile().services), name);
}

function priceMessage(name) {
  return withCustomerName(pick(currentProfile().price), name);
}

function fallbackMenu(name) {
  const options = [
    "Me conta como posso ajudar melhor:\n1) Agendar\n2) Servicos\n3) Preco\n\nSe preferir, pode escrever com suas palavras.",
    "Posso te ajudar com:\n1) Agendar\n2) Servicos\n3) Preco\n\nPode responder com numero ou frase.",
  ];
  return withCustomerName(pick(options), name);
}

function scheduleStartMessage(name) {
  if (env.businessType === "consultorio" || isConsultorioDemoTenant()) {
    const specialties = businessSkills
      .listServices(env.businessType)
      .map((item) => (typeof item === "string" ? item : item?.name || item?.label || item?.title || ""))
      .filter(Boolean)
      .slice(0, 6);
    if (specialties.length) {
      const list = specialties.map((specialty, index) => `${index + 1}) ${specialty}`).join("\n");
      return withCustomerName(
        `Perfeito! Para consulta, me diga a especialidade medica desejada:\n${list}\n\nPode responder com o nome da especialidade.`,
        name
      );
    }
  }
  return generateHumanResponse("ask_service", { name });
}

function askDateMessage(name) {
  return generateHumanResponse("ask_date", { name });
}

function slotChoiceRetryMessage(name) {
  return generateHumanResponse("invalid_slot_choice", { name });
}

function generateHumanResponse(intent, context = {}, rawData = {}) {
  let message = rawData.fallbackText || fallbackMenu();

  if (intent === "no_slots") {
    message = pick(humanResponses.no_slots);
    return withCustomerName(message, context.name);
  }

  if (intent === "slots_list") {
    const slots = rawData.slots || [];
    const list = slots.slice(0, 4).map((slot, index) => `${index + 1}) ${slot.label}`).join("\n");
    message = `${pick(humanResponses.slots_found)}\n${list}\n\n${pick(humanResponses.ask_slot_choice)}`;
    return withCustomerName(message, context.name);
  }

  if (intent === "slots_reminder") {
    const slots = rawData.slots || [];
    if (!slots.length) return withCustomerName(pick(humanResponses.no_slots), context.name);
    const list = slots.slice(0, 4).map((slot, index) => `${index + 1}) ${slot.label}`).join("\n");
    message = `${pick(humanResponses.slots_reminder)}\n${list}\n\n${pick(humanResponses.ask_slot_choice)}`;
    return withCustomerName(message, context.name);
  }

  if (intent === "invalid_slot_choice") {
    message = pick(humanResponses.invalid_slot_choice);
    return withCustomerName(message, context.name);
  }

  if (intent === "slot_unavailable") {
    const slots = rawData.slots || [];
    const list = slots.slice(0, 4).map((slot, index) => `${index + 1}) ${slot.label}`).join("\n");
    if (!slots.length) return withCustomerName(pick(humanResponses.no_slots), context.name);
    message = `${pick(humanResponses.slot_unavailable)}\n${list}\n\n${pick(humanResponses.ask_slot_choice)}`;
    return withCustomerName(message, context.name);
  }

  if (intent === "ask_date") {
    message = pick(humanResponses.ask_date);
    return withCustomerName(message, context.name);
  }

  if (intent === "ask_service") {
    message = pick(humanResponses.ask_service);
    return withCustomerName(message, context.name);
  }

  if (intent === "missing_info") {
    const field = context.field || "o dado que falta";
    message = pick(humanResponses.missing_info).replace("{field}", field);
    return withCustomerName(message, context.name);
  }

  return withCustomerName(message, context.name);
}

module.exports = {
  greetingMessage,
  servicesMessage,
  priceMessage,
  fallbackMenu,
  scheduleStartMessage,
  askDateMessage,
  slotChoiceRetryMessage,
  generateHumanResponse,
};
