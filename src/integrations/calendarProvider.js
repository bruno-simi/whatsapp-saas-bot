const env = require("../config/env");
const logger = require("../utils/logger");
const mock = require("./googleCalendarMock");
const real = require("./googleCalendarReal");

function shouldUseMock() {
  if (env.useCalendarMock) {
    return true;
  }
  return !env.googleCalendarId || !env.googleCredentials;
}

async function listAvailableSlots(dateTime) {
  if (shouldUseMock()) {
    logger.warn("calendarProvider", "Usando modo mock para listar horarios");
    return mock.listAvailableSlots(dateTime);
  }
  try {
    return await real.listAvailableSlots(dateTime);
  } catch (error) {
    logger.error("calendarProvider", "Falha no Google Calendar real ao listar horarios", error.message);
    return [];
  }
}

async function createEvent(payload) {
  if (shouldUseMock()) {
    logger.warn("calendarProvider", "Usando modo mock para criar evento");
    return mock.createEvent(payload);
  }
  try {
    return await real.createEvent(payload);
  } catch (error) {
    logger.error("calendarProvider", "Falha no Google Calendar real, fallback para mock", error.message);
    return mock.createEvent(payload);
  }
}

module.exports = {
  listAvailableSlots,
  createEvent,
};
