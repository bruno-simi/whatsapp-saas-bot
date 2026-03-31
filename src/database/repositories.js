const db = require("./client");
const env = require("../config/env");
const { STATES } = require("../utils/constants");

function nowIso() {
  return new Date().toISOString();
}

function findOrCreateUser(phone) {
  const findStmt = db.prepare("SELECT * FROM users WHERE tenant_id = ? AND phone = ?");
  const found = findStmt.get(env.tenantId, phone);
  if (found) {
    return found;
  }

  const insert = db.prepare(`
    INSERT INTO users (tenant_id, phone, state, last_interaction_at)
    VALUES (?, ?, ?, ?)
  `);
  insert.run(env.tenantId, phone, STATES.IDLE, nowIso());
  return findStmt.get(env.tenantId, phone);
}

function updateUserState(userId, patch) {
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const next = {
    state: patch.state ?? current.state,
    name: patch.name ?? current.name,
    current_service: patch.current_service ?? current.current_service,
    current_date_text: patch.current_date_text ?? current.current_date_text,
    current_slot: patch.current_slot ?? current.current_slot,
    last_interaction_at: nowIso(),
  };

  db.prepare(`
    UPDATE users
    SET state = ?, name = ?, current_service = ?, current_date_text = ?, current_slot = ?, last_interaction_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.state,
    next.name,
    next.current_service,
    next.current_date_text,
    next.current_slot,
    next.last_interaction_at,
    userId
  );

  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function saveMessage(userId, direction, content) {
  db.prepare(`
    INSERT INTO messages (tenant_id, user_id, direction, content)
    VALUES (?, ?, ?, ?)
  `).run(env.tenantId, userId, direction, content);
}

function createAppointment(payload) {
  const stmt = db.prepare(`
    INSERT INTO appointments (tenant_id, user_id, service, start_at, end_at, phone, status, calendar_event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    env.tenantId,
    payload.userId,
    payload.service,
    payload.startAt,
    payload.endAt,
    payload.phone,
    payload.status || "confirmed",
    payload.calendarEventId || null
  );

  return db.prepare("SELECT * FROM appointments WHERE id = ?").get(result.lastInsertRowid);
}

function listAppointmentsInRange(startAt, endAt) {
  return db.prepare(`
    SELECT *
    FROM appointments
    WHERE tenant_id = ?
      AND status = 'confirmed'
      AND start_at < ?
      AND end_at > ?
    ORDER BY start_at ASC
  `).all(env.tenantId, endAt, startAt);
}

module.exports = {
  findOrCreateUser,
  updateUserState,
  saveMessage,
  createAppointment,
  listAppointmentsInRange,
};
