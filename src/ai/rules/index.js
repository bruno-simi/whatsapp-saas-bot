const { applyConversationalRules } = require("./conversationalRules");
const { applyIntentRules } = require("./intentRules");
const { applyFallbackRules } = require("./fallbackRules");

function applyRules(message) {
  const handlers = [applyConversationalRules, applyIntentRules, applyFallbackRules];
  for (const handle of handlers) {
    const result = handle(message);
    if (result) return result;
  }
  return null;
}

module.exports = {
  applyRules,
};
