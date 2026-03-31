const SKILLS = {
  barbearia: {
    services: ["corte", "barba", "combo corte+barba"],
    pricing: "Corte a partir de R$ 35, barba R$ 25 e combo R$ 55.",
  },
  oficina: {
    services: ["revisao", "troca de oleo", "diagnostico"],
    pricing: "Os valores variam por modelo e servico, te passo uma estimativa.",
  },
  consultorio: {
    services: ["consulta medica", "consulta odontologica", "procedimentos esteticos"],
    pricing: "Os valores dependem do procedimento. Posso te orientar.",
  },
};

function currentSkill(businessType) {
  return SKILLS[(businessType || "").toLowerCase()] || SKILLS.barbearia;
}

function listServices(businessType) {
  return currentSkill(businessType).services;
}

function getPricing(businessType) {
  return currentSkill(businessType).pricing;
}

module.exports = {
  listServices,
  getPricing,
};
