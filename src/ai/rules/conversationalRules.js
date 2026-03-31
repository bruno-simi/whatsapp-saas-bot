const { normalizeText } = require("../../utils/text");
const responseService = require("../../services/responseService");

function applyConversationalRules(message) {
  const normalized = normalizeText(message || "");
  if (!normalized) return null;

  if (["oi", "ola", "bom dia", "boa tarde", "boa noite"].includes(normalized)) {
    return {
      handled: true,
      reply: responseService.greetingMessage(),
      intent: "greeting",
      source: "rule:conversational",
    };
  }

  return null;
}

module.exports = {
  applyConversationalRules,
};
