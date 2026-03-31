const { normalizeText } = require("../utils/text");

const KEYWORDS = {
  greeting: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai", "fala"],
  schedule: ["agendar", "marcar", "horario", "amanha", "amanhã", "agenda", "disponibilidade", "quero um horario"],
  price: ["preco", "valor", "quanto custa", "quanto", "orcamento", "tabela de preco"],
  services: ["servicos", "serviços", "o que fazem", "procedimentos", "atendimentos", "trabalham com"],
};

const OPTION_WORDS = {
  1: ["1", "primeira", "primeiro", "um", "uma"],
  2: ["2", "segunda", "segundo", "dois", "duas"],
  3: ["3", "terceira", "terceiro", "tres", "três"],
  4: ["4", "quarta", "quarto", "quatro"],
};

function hasAny(text, words) {
  return words.some((word) => text.includes(normalizeText(word)));
}

function extractChoice(message, max = 4) {
  const text = normalizeText(message);
  const numberMatch = text.match(/\b([1-9]\d?)\b/);
  if (numberMatch) {
    const value = Number(numberMatch[1]);
    if (value >= 1 && value <= max) return value;
  }

  for (let option = 1; option <= max; option += 1) {
    const words = OPTION_WORDS[option] || [];
    if (words.some((word) => text.includes(normalizeText(word)))) {
      return option;
    }
  }

  return null;
}

function detectIntent(message) {
  const text = normalizeText(message);

  if (hasAny(text, KEYWORDS.schedule)) return "schedule";
  if (hasAny(text, KEYWORDS.price)) return "price";
  if (hasAny(text, KEYWORDS.services)) return "services";
  if (hasAny(text, KEYWORDS.greeting)) return "greeting";
  return "unknown";
}

module.exports = {
  detectIntent,
  extractChoice,
};
