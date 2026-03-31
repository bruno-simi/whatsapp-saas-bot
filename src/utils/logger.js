function stamp() {
  return new Date().toISOString();
}

function log(level, scope, message, meta) {
  if (meta) {
    console.log(`[${stamp()}] [${level}] [${scope}] ${message}`, meta);
    return;
  }

  console.log(`[${stamp()}] [${level}] [${scope}] ${message}`);
}

module.exports = {
  info: (scope, message, meta) => log("INFO", scope, message, meta),
  warn: (scope, message, meta) => log("WARN", scope, message, meta),
  error: (scope, message, meta) => log("ERROR", scope, message, meta),
};
