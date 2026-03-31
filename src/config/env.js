const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "..", "..");

const env = {
  port: Number(process.env.PORT || 3000),
  businessType: (process.env.BUSINESS_TYPE || "barbearia").toLowerCase(),
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || "",
  googleCredentials: process.env.GOOGLE_CREDENTIALS || "",
  useCalendarMock: (process.env.USE_CALENDAR_MOCK || "false").toLowerCase() === "true",
  allowSelfMessages: (process.env.ALLOW_SELF_MESSAGES || "false").toLowerCase() === "true",
  sessionTimeoutMinutes: Number(process.env.SESSION_TIMEOUT_MINUTES || 20),
  tenantId: process.env.TENANT_ID || "default",
  sqlitePath: process.env.SQLITE_PATH || path.join(rootDir, "data", "app.sqlite"),
  useAi: (process.env.USE_AI || "false").toLowerCase() === "true",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 8000),
};

module.exports = env;
