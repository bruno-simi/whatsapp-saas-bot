const { normalizeText } = require("../../utils/text");

function applyIntentRules(message) {
  const normalized = normalizeText(message || "");
  if (!normalized) return null;

  if (normalized === "menu") {
    return {
      handled: false,
      useLegacyFlow: true,
      intent: "menu",
      source: "rule:intent",
    };
  }

  if (["1", "2", "3"].includes(normalized)) {
    return {
      handled: false,
      useLegacyFlow: true,
      intent: "menu_choice",
      source: "rule:intent",
    };
  }

  return null;
}

module.exports = {
  applyIntentRules,
};
