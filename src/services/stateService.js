const dayjs = require("dayjs");
const env = require("../config/env");
const { STATES } = require("../utils/constants");
const repos = require("../database/repositories");

function getUser(phone) {
  const user = repos.findOrCreateUser(phone);
  const lastInteraction = dayjs(user.last_interaction_at);
  const diffMinutes = dayjs().diff(lastInteraction, "minute");

  if (diffMinutes > env.sessionTimeoutMinutes && user.state !== STATES.IDLE) {
    return repos.updateUserState(user.id, {
      state: STATES.IDLE,
      current_service: null,
      current_date_text: null,
      current_slot: null,
    });
  }

  return user;
}

function setState(user, patch) {
  return repos.updateUserState(user.id, patch);
}

module.exports = {
  getUser,
  setState,
};
