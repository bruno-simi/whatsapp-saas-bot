const dayjs = require("dayjs");

function generateSlots(baseDateTime) {
  const base = dayjs(baseDateTime).minute(0).second(0);
  const slots = [];
  for (let i = 1; i <= 5; i += 1) {
    const start = base.add(i, "hour");
    slots.push({
      start: start.toISOString(),
      end: start.add(45, "minute").toISOString(),
      label: start.format("DD/MM HH:mm"),
    });
  }
  return slots;
}

module.exports = {
  async listAvailableSlots(dateTime) {
    return generateSlots(dateTime || new Date().toISOString());
  },

  async createEvent(payload) {
    return {
      id: `mock-${Date.now()}`,
      ...payload,
    };
  },
};
