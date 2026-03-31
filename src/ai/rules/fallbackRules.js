function applyFallbackRules(message) {
  if (!message || !message.trim()) {
    return {
      handled: true,
      reply: "Pode me enviar sua mensagem novamente?",
      intent: "unknown",
      source: "rule:fallback",
    };
  }

  return null;
}

module.exports = {
  applyFallbackRules,
};
