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

/** Passo minimo entre inicios de consulta: evita listar varios horarios sobrepostos (ex.: 16:10 e 16:20 para slot de 45min). */
function resolveBookingStepMinutes(settings, durationMinutes) {
  const configured = Number(settings.intervalMinutes || 5);
  const duration = Number(durationMinutes);
  const safeConfigured = Number.isFinite(configured) && configured > 0 ? configured : 5;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 45;
  return Math.max(safeConfigured, safeDuration);
}

function dedupeSlotsByStart(slots) {
  const seen = new Set();
  const out = [];
  for (const slot of slots) {
    const key = slot?.start;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(slot);
  }
  return out;
}

/** Remove slots que se sobrepõem no tempo (mantem o mais cedo). */
function removeOverlappingSlots(slots) {
  const sorted = [...slots].sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  const out = [];
  for (const slot of sorted) {
    const sStart = dayjs(slot.start);
    const sEnd = dayjs(slot.end);
    const overlaps = out.some((prev) => {
      const pStart = dayjs(prev.start);
      const pEnd = dayjs(prev.end);
      return sStart.isBefore(pEnd) && sEnd.isAfter(pStart);
    });
    if (!overlaps) out.push(slot);
  }
  return out;
}

async function getSlots(dateText, options = {}) {
  const durationMinutes = Number(options.durationMinutes || getServiceDurationMinutes(options.serviceName));
  const settings = getBusinessSettings();
  const stepMinutes = resolveBookingStepMinutes(settings, durationMinutes);
  const rawInput = String(dateText || "").trim();
  let dateTime;
  if (
    (/^\d{4}-\d{2}-\d{2}T/i.test(rawInput) || /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(rawInput) || rawInput.endsWith("Z"))
    && dayjs(rawInput).isValid()
  ) {
    dateTime = dayjs(rawInput).toISOString();
  } else {
    const parsedDate = await parseDateText(dateText);
    const normalizedDate = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(parsedDate)
      ? parsedDate.replace(" ", "T")
      : parsedDate;
    dateTime = dayjs(normalizedDate).isValid()
      ? dayjs(normalizedDate).toISOString()
      : dayjs().add(1, "day").hour(9).minute(0).second(0).millisecond(0).toISOString();
  }
  let slots = await calendar.getAvailableSlots(dateTime, {
    intervalMinutes: stepMinutes,
    openingHours: settings.openingHours || null,
    durationMinutes,
  });
  if (!slots.length) return slots;

  slots = dedupeSlotsByStart(slots);
  slots = removeOverlappingSlots(slots);

  const firstStart = slots[0].start;
  const lastEnd = slots[slots.length - 1].end;
  const localAppointments = repos.listAppointmentsInRange(firstStart, lastEnd);
  if (!localAppointments.length) return slots;

  return removeOverlappingSlots(
    slots.filter((slot) => {
      const slotStart = dayjs(slot.start);
      const slotEnd = dayjs(slot.end);
      const hasConflict = localAppointments.some((appointment) => {
        const appointmentStart = dayjs(appointment.start_at);
        const appointmentEnd = dayjs(appointment.end_at);
        return slotStart.isBefore(appointmentEnd) && slotEnd.isAfter(appointmentStart);
      });
      return !hasConflict;
    })
  );
}

async function getNextAvailableSlots(dateText, options = {}) {
  const daysToSearch = Number(options.daysToSearch || 5);
  const maxSlots = Number(options.maxSlots || 4);
  const parsedDate = await parseDateText(dateText);
  const base = dayjs(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(parsedDate) ? parsedDate.replace(" ", "T") : parsedDate);
  const anchor = base.isValid() ? base.startOf("day") : dayjs().startOf("day");
  const results = [];
  for (let offset = 0; offset < daysToSearch; offset += 1) {
    const dayRef = anchor.add(offset, "day").format("YYYY-MM-DD 09:00");
    const slots = await getSlots(dayRef, options);
    if (slots.length) {
      results.push(...slots);
    }
    if (results.length >= maxSlots) {
      break;
    }
  }
  return removeOverlappingSlots(dedupeSlotsByStart(results)).slice(0, maxSlots);
}

async function confirmAppointment({ user, phone, service, slot, name }) {
  const settings = getBusinessSettings();
  const durationMinutes = getServiceDurationMinutes(service);
  const stepMinutes = resolveBookingStepMinutes(settings, durationMinutes);
  const hasConflict = await calendar.checkConflicts(slot.start, durationMinutes, {
    intervalMinutes: stepMinutes,
    openingHours: settings.openingHours || null,
  });
  if (hasConflict) {
    const error = new Error("Horario indisponivel");
    error.code = "SLOT_UNAVAILABLE";
    throw error;
  }

  const availableSlots = await getSlots(slot.start, { durationMinutes, serviceName: service });
  const stillAvailable = availableSlots.some(
    (availableSlot) =>
      dayjs(availableSlot.start).valueOf() === dayjs(slot.start).valueOf()
      && dayjs(availableSlot.end).valueOf() === dayjs(slot.end).valueOf()
  );
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
