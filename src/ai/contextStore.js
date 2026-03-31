const MAX_MESSAGES = 6;

const contexts = new Map();

function getDefaultContext() {
  return {
    currentState: "IDLE",
    lastIntent: "unknown",
    collectedData: {},
    lastMessages: [],
  };
}

function sanitizeContext(context) {
  return {
    currentState: context.currentState || "IDLE",
    lastIntent: context.lastIntent || "unknown",
    collectedData: context.collectedData || {},
    lastMessages: Array.isArray(context.lastMessages)
      ? context.lastMessages.slice(-MAX_MESSAGES)
      : [],
  };
}

function getContext(phone) {
  if (!contexts.has(phone)) {
    contexts.set(phone, getDefaultContext());
  }
  return contexts.get(phone);
}

function updateContext(phone, data = {}) {
  const current = getContext(phone);
  const next = sanitizeContext({
    ...current,
    ...data,
    collectedData: {
      ...current.collectedData,
      ...(data.collectedData || {}),
    },
  });

  contexts.set(phone, next);
  return next;
}

module.exports = {
  getContext,
  updateContext,
};
