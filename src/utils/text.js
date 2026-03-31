function normalizeText(input) {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function firstWord(input) {
  const normalized = normalizeText(input);
  return normalized.split(/\s+/)[0] || "";
}

module.exports = {
  normalizeText,
  firstWord,
};
