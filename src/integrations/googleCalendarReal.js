const { google } = require("googleapis");
const dayjs = require("dayjs");
const env = require("../config/env");
const repos = require("../database/repositories");

function resolveCalendarId() {
  const business = repos.getBusiness();
  return business?.calendar_id || env.googleCalendarId;
}

function buildGoogleClient() {
  if (!env.googleCredentials || !resolveCalendarId()) {
    throw new Error("Google Calendar nao configurado");
  }

  const credentials = JSON.parse(env.googleCredentials);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

function toSlotLabel(startIso, endIso) {
  return `${dayjs(startIso).format("DD/MM HH:mm")} - ${dayjs(endIso).format("HH:mm")}`;
}

async function listAvailableSlots(dateTime, options = {}) {
  const calendar = buildGoogleClient();
  const calendarId = resolveCalendarId();
  const dayStart = dayjs(dateTime).startOf("day").hour(8);
  const dayEnd = dayjs(dateTime).startOf("day").hour(18);
  const durationMinutes = Number(options.durationMinutes || 45);
  const intervalMinutes = Number(options.intervalMinutes || 60);

  const busy = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busyRanges = busy.data.calendars[calendarId]?.busy || [];
  const slots = [];

  for (
    let minute = dayStart.hour() * 60;
    minute < dayEnd.hour() * 60;
    minute += intervalMinutes
  ) {
    const start = dayjs(dateTime)
      .startOf("day")
      .add(minute, "minute")
      .second(0)
      .millisecond(0);
    const end = start.add(durationMinutes, "minute");
    if (end.isAfter(dayEnd)) {
      continue;
    }
    const conflict = busyRanges.some((range) => {
      const busyStart = dayjs(range.start);
      const busyEnd = dayjs(range.end);
      return start.isBefore(busyEnd) && end.isAfter(busyStart);
    });
    if (!conflict && start.isAfter(dayjs().subtract(1, "minute"))) {
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: toSlotLabel(start.toISOString(), end.toISOString()),
      });
    }
  }

  return slots;
}

async function createEvent(payload) {
  const calendar = buildGoogleClient();
  const calendarId = resolveCalendarId();
  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${payload.service} - ${payload.name}`,
      description: `Agendado via bot WhatsApp\nTelefone: ${payload.phone}`,
      start: { dateTime: payload.startAt },
      end: { dateTime: payload.endAt },
    },
  });

  return event.data;
}

module.exports = {
  listAvailableSlots,
  createEvent,
};
