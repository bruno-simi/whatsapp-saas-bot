const dayjs = require("dayjs");
const calendarProvider = require("../integrations/calendarProvider");
const repos = require("../database/repositories");

function parseDateText(input) {
  const text = (input || "").toLowerCase();
  if (text.includes("amanha") || text.includes("amanhã")) {
    return dayjs().add(1, "day").hour(9).minute(0).second(0).millisecond(0).toISOString();
  }
  const maybeDate = dayjs(input, ["DD/MM/YYYY", "DD/MM", "YYYY-MM-DD"], true);
  if (maybeDate.isValid()) {
    return maybeDate.hour(9).minute(0).second(0).millisecond(0).toISOString();
  }
  return dayjs().add(1, "day").hour(9).minute(0).second(0).millisecond(0).toISOString();
}

async function getSlots(dateText) {
  const dateTime = parseDateText(dateText);
  return calendarProvider.listAvailableSlots(dateTime);
}

async function confirmAppointment({ user, phone, service, slot, name }) {
  const event = await calendarProvider.createEvent({
    service,
    phone,
    startAt: slot.start,
    endAt: slot.end,
    name,
  });

  const appointment = repos.createAppointment({
    userId: user.id,
    service,
    startAt: slot.start,
    endAt: slot.end,
    phone,
    calendarEventId: event.id,
    status: "confirmed",
  });

  return { appointment, event };
}

module.exports = {
  getSlots,
  confirmAppointment,
};
