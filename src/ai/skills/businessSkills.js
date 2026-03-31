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
const repos = require("../../database/repositories");
const { normalizeText } = require("../../utils/text");
const env = require("../../config/env");

function safeJson(input, fallback = {}) {
  try {
    return JSON.parse(input || "{}");
  } catch (error) {
    return fallback;
  }
}

function currentSkill(businessType) {
  return SKILLS[(businessType || "").toLowerCase()] || SKILLS.barbearia;
}

function listServices(businessType) {
  const business = repos.getBusiness();
  const settings = safeJson(business?.settings, {});
  if (Array.isArray(settings.services) && settings.services.length) {
    return settings.services;
  }
  return currentSkill(businessType).services;
}

function getPricing(businessType) {
  return currentSkill(businessType).pricing;
}

function serviceLabel(service) {
  if (typeof service === "string") return service;
  if (!service || typeof service !== "object") return "";
  return service.name || service.label || service.title || service.service || "";
}

function matchServiceFromText(text, businessType) {
  const normalized = normalizeText(text || "");
  const servicesRaw = listServices(businessType || env.businessType) || [];
  const services = servicesRaw
    .map((service) => serviceLabel(service))
    .filter(Boolean);
  const direct = services.find((service) => normalized.includes(normalizeText(service))) || null;
  if (direct) return direct;
  if (normalized.includes("consulta")) {
    return services.find((service) => normalizeText(service).includes("consulta")) || null;
  }
  if (normalized.includes("medic")) {
    return services.find((service) => normalizeText(service).includes("consulta")) || null;
  }
  return null;
}

module.exports = {
  listServices,
  getPricing,
  matchServiceFromText,
};
