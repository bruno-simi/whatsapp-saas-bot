const dayjs = require("dayjs");
const calendar = require("../integrations/calendar");
const repos = require("../database/repositories");
const { parseDateText } = require("../utils/dateParser");
const logger = require("../utils/logger");

function safeJson(input, fallback = {}) {
  try {
    return JSON.parse(input || "{}");
  } catch (error) {
    return fallback;
  }
}

function getBusinessSettings() {
  const business = repos.getBusiness();
  return safeJson(business?.settings, {});
}

function getServiceDurationMinutes(serviceName) {
  const settings = getBusinessSettings();
  const durations = settings.serviceDurations || {};
  const duration = Number(durations[serviceName] || 45);
  return Number.isFinite(duration) && duration > 0 ? duration : 45;
}

async function getSlots(dateText, options = {}) {
  const durationMinutes = Number(options.durationMinutes || getServiceDurationMinutes(options.serviceName));
  const parsedDate = await parseDateText(dateText);
  const normalizedDate = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(parsedDate)
    ? parsedDate.replace(" ", "T")
    : parsedDate;
  const settings = getBusinessSettings();
  const dateTime = dayjs(normalizedDate).isValid()
    ? dayjs(normalizedDate).toISOString()
    : dayjs().add(1, "day").hour(9).minute(0).second(0).millisecond(0).toISOString();
  const slots = await calendar.getAvailableSlots(dateTime, {
    intervalMinutes: settings.intervalMinutes || 5,
    openingHours: settings.openingHours || null,
    durationMinutes,
  });
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

async function getNextAvailableSlots(dateText, options = {}) {
  const daysToSearch = Number(options.daysToSearch || 5);
  const maxSlots = Number(options.maxSlots || 4);
  const parsedDate = await parseDateText(dateText);
  const base = dayjs(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(parsedDate) ? parsedDate.replace(" ", "T") : parsedDate);
  const results = [];
  for (let offset = 1; offset <= daysToSearch; offset += 1) {
    const dayRef = (base.isValid() ? base : dayjs()).add(offset, "day").format("YYYY-MM-DD 09:00");
    const slots = await getSlots(dayRef, options);
    if (slots.length) {
      results.push(...slots);
    }
    if (results.length >= maxSlots) {
      break;
    }
  }
  return results.slice(0, maxSlots);
}

async function confirmAppointment({ user, phone, service, slot, name }) {
  const settings = getBusinessSettings();
  const durationMinutes = getServiceDurationMinutes(service);
  const hasConflict = await calendar.checkConflicts(slot.start, durationMinutes, {
    intervalMinutes: settings.intervalMinutes || 5,
    openingHours: settings.openingHours || null,
  });
  if (hasConflict) {
    const error = new Error("Horario indisponivel");
    error.code = "SLOT_UNAVAILABLE";
    throw error;
  }

  const availableSlots = await getSlots(slot.start, { durationMinutes });
  const stillAvailable = availableSlots.some((availableSlot) => availableSlot.start === slot.start && availableSlot.end === slot.end);
  if (!stillAvailable) {
    const error = new Error("Horario indisponivel");
    error.code = "SLOT_UNAVAILABLE";
    throw error;
  }

  const customer = repos.findOrCreateCustomer(phone, { name: name || user.name || null });
  const event = await calendar.createEvent({
    service,
    phone,
    startAt: slot.start,
    endAt: slot.end,
    name,
  });

  const appointment = repos.createAppointment({
    userId: user.id,
    customerId: customer.id,
    service,
    startAt: slot.start,
    endAt: slot.end,
    phone,
    calendarEventId: event.id,
    status: "confirmed",
  });

  repos.updateCustomerMemory(customer.id, {
    name: name || user.name || customer.name,
    last_service: service,
    last_visit: slot.start,
  });

  logger.info("appointmentService", "Agendamento confirmado", {
    phone,
    customerId: customer.id,
    appointmentId: appointment.id,
    service,
    startAt: slot.start,
  });

  return { appointment, event };
}

module.exports = {
  getSlots,
  getNextAvailableSlots,
  confirmAppointment,
};
