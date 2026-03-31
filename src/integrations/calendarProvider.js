const env = require("../config/env");
const logger = require("../utils/logger");
const repos = require("../database/repositories");
const mock = require("./googleCalendarMock");
const real = require("./googleCalendarReal");

function shouldUseMock() {
  const business = repos.getBusiness();
  const businessCalendarId = business?.calendar_id || "";
  if (env.useCalendarMock) {
    return true;
  }
  return (!env.googleCalendarId && !businessCalendarId) || !env.googleCredentials;
}

async function listAvailableSlots(dateTime, options = {}) {
  if (shouldUseMock()) {
    logger.warn("calendarProvider", "Usando modo mock para listar horarios");
    return mock.listAvailableSlots(dateTime, options);
  }
  try {
    return await real.listAvailableSlots(dateTime, options);
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
