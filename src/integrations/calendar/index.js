const dayjs = require("dayjs");
const calendarProvider = require("../calendarProvider");
const repos = require("../../database/repositories");

const WEEK_DAYS = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function parseHourMinute(value, fallbackHour) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hour: fallbackHour, minute: 0 };
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function resolveWindow(openingHours, date) {
  if (!openingHours || typeof openingHours !== "object") return null;
  const day = dayjs(date).day();
  const byNumber = openingHours[String(day)] || openingHours[day];
  const byName = Object.entries(WEEK_DAYS).find(([, value]) => value === day)?.[0];
  const byLabel = byName ? openingHours[byName] : null;
  return byNumber || byLabel || null;
}

function applyOpeningHours(slots, openingHours) {
  return slots.filter((slot) => {
    const window = resolveWindow(openingHours, slot.start);
    if (!window || !window.start || !window.end) return true;
    const startConfig = parseHourMinute(window.start, 8);
    const endConfig = parseHourMinute(window.end, 18);
    const slotStart = dayjs(slot.start);
    const slotEnd = dayjs(slot.end);
    const min = slotStart
      .startOf("day")
      .hour(startConfig.hour)
      .minute(startConfig.minute)
      .second(0)
      .millisecond(0);
    const max = slotStart
      .startOf("day")
      .hour(endConfig.hour)
      .minute(endConfig.minute)
      .second(0)
      .millisecond(0);
    return (slotStart.isAfter(min) || slotStart.isSame(min)) && (slotEnd.isBefore(max) || slotEnd.isSame(max));
  });
}

function applyDuration(slots, durationMinutes) {
  const duration = Number(durationMinutes || 45);
  if (!Number.isFinite(duration) || duration <= 0) return slots;
  return slots.map((slot) => {
    const start = dayjs(slot.start);
    const end = start.add(duration, "minute");
    return {
      ...slot,
      end: end.toISOString(),
      label: `${start.format("DD/MM HH:mm")} - ${end.format("HH:mm")}`,
    };
  });
}

async function checkConflicts(datetime, durationMinutes = 45, options = {}) {
  const startAt = dayjs(datetime).toISOString();
  const endAt = dayjs(datetime).add(durationMinutes, "minute").toISOString();
  const localConflicts = repos.listAppointmentsInRange(startAt, endAt);
  if (localConflicts.length > 0) return true;

  const slots = await getAvailableSlots(datetime, {
    durationMinutes,
    intervalMinutes: options.intervalMinutes ?? 5,
    openingHours: options.openingHours ?? null,
  });
  return !slots.some((slot) => slot.start === startAt && slot.end === endAt);
}

async function getAvailableSlots(date, options = {}) {
  const dateTime = dayjs(date).toISOString();
  const all = await calendarProvider.listAvailableSlots(dateTime, options);
  const withDuration = applyDuration(all, options.durationMinutes || 45);
  const withOpeningHours = applyOpeningHours(withDuration, options.openingHours);
  const gapMinutes = Number(options.intervalMinutes || 0);
  if (!gapMinutes) return withOpeningHours;

  return withOpeningHours.filter((slot, index) => {
    if (index === 0) return true;
    const prev = withOpeningHours[index - 1];
    const diff = dayjs(slot.start).diff(dayjs(prev.end), "minute");
    return diff >= gapMinutes;
  });
}

async function createEvent(data) {
  return calendarProvider.createEvent(data);
}

module.exports = {
  getAvailableSlots,
  createEvent,
  checkConflicts,
};
