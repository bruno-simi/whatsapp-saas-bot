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
    INSERT INTO appointments (tenant_id, user_id, customer_id, service, start_at, end_at, phone, status, calendar_event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    env.tenantId,
    payload.userId,
    payload.customerId || null,
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

function findOrCreateCustomer(phone, patch = {}) {
  const findStmt = db.prepare("SELECT * FROM customers WHERE tenant_id = ? AND phone = ?");
  const found = findStmt.get(env.tenantId, phone);
  if (found) {
    const nextName = patch.name ?? found.name;
    const nextNotes = patch.notes ?? found.notes;
    db.prepare(`
      UPDATE customers
      SET name = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextName, nextNotes, found.id);
    return findStmt.get(env.tenantId, phone);
  }

  db.prepare(`
    INSERT INTO customers (tenant_id, phone, name, notes)
    VALUES (?, ?, ?, ?)
  `).run(env.tenantId, phone, patch.name || null, patch.notes || null);

  return findStmt.get(env.tenantId, phone);
}

function updateCustomerMemory(customerId, patch = {}) {
  const current = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
  if (!current) return null;
  db.prepare(`
    UPDATE customers
    SET
      name = ?,
      last_service = ?,
      last_visit = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    patch.name ?? current.name,
    patch.last_service ?? current.last_service,
    patch.last_visit ?? current.last_visit,
    patch.notes ?? current.notes,
    customerId
  );
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
}

function listRecentAppointmentsByCustomer(customerId, limit = 3) {
  return db.prepare(`
    SELECT *
    FROM appointments
    WHERE tenant_id = ?
      AND customer_id = ?
    ORDER BY start_at DESC
    LIMIT ?
  `).all(env.tenantId, customerId, limit);
}

function getBusiness() {
  const row = db.prepare("SELECT * FROM businesses WHERE id = ?").get(env.tenantId);
  if (row) return row;
  db.prepare(`
    INSERT OR IGNORE INTO businesses (id, name, type, calendar_id, settings)
    VALUES (?, ?, ?, ?, ?)
  `).run(env.tenantId, "Negocio", env.businessType, null, "{}");
  return db.prepare("SELECT * FROM businesses WHERE id = ?").get(env.tenantId);
}

function getActiveSubscription() {
  return db.prepare(`
    SELECT *
    FROM subscriptions
    WHERE business_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(env.tenantId);
}

function updateBusinessSettings(patch = {}) {
  const business = getBusiness();
  let currentSettings = {};
  try {
    currentSettings = JSON.parse(business.settings || "{}");
  } catch (error) {
    currentSettings = {};
  }
  const nextSettings = {
    ...currentSettings,
    ...patch,
  };
  db.prepare(`
    UPDATE businesses
    SET settings = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(nextSettings), env.tenantId);
  return getBusiness();
}

function updateBusinessProfile(patch = {}) {
  const current = getBusiness();
  const next = {
    name: patch.name ?? current.name,
    type: patch.type ?? current.type,
    calendar_id: patch.calendar_id ?? current.calendar_id,
  };
  db.prepare(`
    UPDATE businesses
    SET name = ?, type = ?, calendar_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next.name, next.type, next.calendar_id, env.tenantId);
  return getBusiness();
}

function setWhatsappIntegration(businessId, phoneNumber) {
  db.prepare(`
    INSERT INTO whatsapp_integrations (business_id, phone_number, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(phone_number) DO UPDATE SET
      business_id = excluded.business_id,
      updated_at = CURRENT_TIMESTAMP
  `).run(businessId, phoneNumber);

  return db.prepare(`
    SELECT *
    FROM whatsapp_integrations
    WHERE phone_number = ?
  `).get(phoneNumber);
}

function getWhatsappIntegrationByPhone(phoneNumber) {
  return db.prepare(`
    SELECT *
    FROM whatsapp_integrations
    WHERE phone_number = ?
    LIMIT 1
  `).get(phoneNumber);
}

function getWhatsappIntegrationByBusinessId(businessId) {
  return db.prepare(`
    SELECT *
    FROM whatsapp_integrations
    WHERE business_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(businessId);
}

module.exports = {
  findOrCreateUser,
  updateUserState,
  saveMessage,
  createAppointment,
  listAppointmentsInRange,
  findOrCreateCustomer,
  updateCustomerMemory,
  listRecentAppointmentsByCustomer,
  getBusiness,
  getActiveSubscription,
  updateBusinessSettings,
  updateBusinessProfile,
  setWhatsappIntegration,
  getWhatsappIntegrationByPhone,
  getWhatsappIntegrationByBusinessId,
};
