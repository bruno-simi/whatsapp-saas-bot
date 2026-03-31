const env = require("../config/env");

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
    greeting: ["Ola, seja bem-vindo. Como posso ajudar no seu atendimento?", "Bom dia! Estou aqui para auxiliar com seu agendamento."],
    services: ["Atendemos consultas medicas, odontologicas e esteticos.", "Realizamos atendimentos em consulta e procedimentos esteticos."],
    price: ["Os valores dependem do procedimento. Posso te orientar.", "Consigo informar faixa de valor conforme o tipo de consulta."],
  },
};

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function currentProfile() {
  return responses[env.businessType] || responses.barbearia;
}

function greetingMessage() {
  return pick(currentProfile().greeting);
}

function servicesMessage() {
  return pick(currentProfile().services);
}

function priceMessage() {
  return pick(currentProfile().price);
}

function fallbackMenu() {
  const options = [
    "Me conta como posso ajudar melhor:\n1) Agendar\n2) Servicos\n3) Preco\n\nSe preferir, pode escrever com suas palavras.",
    "Posso te ajudar com:\n1) Agendar\n2) Servicos\n3) Preco\n\nPode responder com numero ou frase.",
  ];
  return pick(options);
}

function scheduleStartMessage() {
  return pick([
    "Show! Vamos agendar. Qual servico voce quer?",
    "Perfeito, vamos marcar seu horario. Qual servico voce procura?",
  ]);
}

function askDateMessage() {
  return pick([
    "Perfeito! Agora me diga a data desejada (ex: amanha ou 25/04).",
    "Boa! Me passa a data que voce prefere (ex: amanha ou 25/04).",
  ]);
}

function slotChoiceRetryMessage() {
  return pick([
    "Nao entendi a opcao. Pode me dizer o numero do horario?",
    "Me ajuda com a escolha: envie o numero da opcao do horario.",
  ]);
}

module.exports = {
  greetingMessage,
  servicesMessage,
  priceMessage,
  fallbackMenu,
  scheduleStartMessage,
  askDateMessage,
  slotChoiceRetryMessage,
};
