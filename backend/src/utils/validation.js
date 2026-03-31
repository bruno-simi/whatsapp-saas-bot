function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !payload[field]);
  return missing;
}

module.exports = {
  isEmail,
  requireFields,
};
