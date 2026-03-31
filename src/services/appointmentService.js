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
  const slots = await calendarProvider.listAvailableSlots(dateTime);
  if (!slots.length) return slots;

  const firstStart = slots[0].start;
  const lastEnd = slots[slots.length - 1].end;
  const localAppointments = repos.listAppointmentsInRange(firstStart, lastEnd);
  if (!localAppointments.length) return slots;

  return slots.filter((slot) => {
    const slotStart = dayjs(slot.start);
    const slotEnd = dayjs(slot.end);
    const hasConflict = localAppointments.some((appointment) => {
      const appointmentStart = dayjs(appointment.start_at);
      const appointmentEnd = dayjs(appointment.end_at);
      return slotStart.isBefore(appointmentEnd) && slotEnd.isAfter(appointmentStart);
    });
    return !hasConflict;
  });
}

async function confirmAppointment({ user, phone, service, slot, name }) {
  const localConflicts = repos.listAppointmentsInRange(slot.start, slot.end);
  if (localConflicts.length) {
    const error = new Error("Horario indisponivel");
    error.code = "SLOT_UNAVAILABLE";
    throw error;
  }

  const availableSlots = await getSlots(slot.start);
  const stillAvailable = availableSlots.some((availableSlot) => availableSlot.start === slot.start && availableSlot.end === slot.end);
  if (!stillAvailable) {
    const error = new Error("Horario indisponivel");
    error.code = "SLOT_UNAVAILABLE";
    throw error;
  }

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
