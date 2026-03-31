const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const env = require("../config/env");

const dbDir = path.dirname(env.sqlitePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(env.sqlitePath);
db.exec("PRAGMA journal_mode = WAL;");

module.exports = db;
