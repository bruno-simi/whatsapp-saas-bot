const intentService = require("../../services/intentService");
const { normalizeText } = require("../../utils/text");

function detectIntent(message) {
  return intentService.detectIntent(message);
}

function extractBasicEntities(message) {
  const text = message || "";
  const normalized = normalizeText(text);

  const dateMatch =
    text.match(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/) ||
    text.match(/\b\d{4}-\d{2}-\d{2}\b/) ||
    (normalized.includes("amanha") ? ["amanha"] : null) ||
    (normalized.includes("hoje") ? ["hoje"] : null);

  const nameMatch = text.match(/\b(meu nome e|me chamo)\s+([A-Za-zÀ-ÿ]+)\b/i);

  return {
    date: dateMatch ? dateMatch[0] : null,
    name: nameMatch ? nameMatch[2] : null,
  };
}

function handleFallback() {
  return {
    intent: "unknown",
    service: null,
    date: null,
    name: null,
    response: "Nao entendi perfeitamente. Se quiser, digite *menu* para seguir pelo fluxo rapido.",
  };
}

module.exports = {
  detectIntent,
  extractBasicEntities,
  handleFallback,
};
