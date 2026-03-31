const { google } = require("googleapis");
const dayjs = require("dayjs");
const env = require("../config/env");

function buildGoogleClient() {
  if (!env.googleCredentials || !env.googleCalendarId) {
    throw new Error("Google Calendar nao configurado");
  }

  const credentials = JSON.parse(env.googleCredentials);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

function toSlotLabel(dateIso) {
  return dayjs(dateIso).format("DD/MM HH:mm");
}

async function listAvailableSlots(dateTime) {
  const calendar = buildGoogleClient();
  const dayStart = dayjs(dateTime).startOf("day").hour(8);
  const dayEnd = dayjs(dateTime).startOf("day").hour(18);

  const busy = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: env.googleCalendarId }],
    },
  });

  const busyRanges = busy.data.calendars[env.googleCalendarId]?.busy || [];
  const slots = [];

  for (let h = 8; h < 18; h += 1) {
    const start = dayjs(dateTime).startOf("day").hour(h).minute(0).second(0).millisecond(0);
    const end = start.add(45, "minute");
    const conflict = busyRanges.some((range) => {
      const busyStart = dayjs(range.start);
      const busyEnd = dayjs(range.end);
      return start.isBefore(busyEnd) && end.isAfter(busyStart);
    });
    if (!conflict && start.isAfter(dayjs().subtract(1, "minute"))) {
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: toSlotLabel(start.toISOString()),
      });
    }
  }

  return slots;
}

async function createEvent(payload) {
  const calendar = buildGoogleClient();
  const event = await calendar.events.insert({
    calendarId: env.googleCalendarId,
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
