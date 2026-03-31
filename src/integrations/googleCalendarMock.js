const dayjs = require("dayjs");

function generateSlots(baseDateTime, options = {}) {
  const base = dayjs(baseDateTime).second(0).millisecond(0);
  const intervalMinutes = Number(options.intervalMinutes || 60);
  const slots = [];
  for (let i = 0; i < 5; i += 1) {
    const start = base.add(i * intervalMinutes, "minute");
    slots.push({
      start: start.toISOString(),
    });
  }
  return slots;
}

module.exports = {
  async listAvailableSlots(dateTime, options = {}) {
    return generateSlots(dateTime || new Date().toISOString(), options);
  },

  async createEvent(payload) {
    return {
      id: `mock-${Date.now()}`,
      ...payload,
    };
  },
};
