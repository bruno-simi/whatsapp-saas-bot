const http = require("http");
const env = require("./config/env");
const logger = require("./utils/logger");
const { runMigrations } = require("./database/migrations");
const { startWhatsapp } = require("./services/whatsappService");
const repos = require("./database/repositories");

function safeJson(value, fallback = {}) {
  try {
    return JSON.parse(value || "{}");
  } catch (error) {
    return fallback;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function bootstrap() {
  runMigrations();
  logger.info("bootstrap", "SQLite inicializado");

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.url === "/business/settings" && req.method === "GET") {
      const business = repos.getBusiness();
      sendJson(res, 200, {
        businessId: business.id,
        name: business.name,
        type: business.type,
        calendarId: business.calendar_id || null,
        settings: safeJson(business.settings, {}),
      });
      return;
    }

    if (req.url === "/business" && req.method === "GET") {
      const business = repos.getBusiness();
      sendJson(res, 200, {
        businessId: business.id,
        name: business.name,
        type: business.type,
        calendarId: business.calendar_id || null,
      });
      return;
    }

    if (req.url === "/business" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          let payload = {};
          try {
            payload = JSON.parse(body || "{}");
          } catch (error) {
            sendJson(res, 400, { ok: false, error: "JSON invalido" });
            return;
          }
          const updated = repos.updateBusinessProfile({
            name: payload.name,
            type: payload.type,
            calendar_id: payload.calendarId,
          });
          sendJson(res, 200, {
            ok: true,
            businessId: updated.id,
            name: updated.name,
            type: updated.type,
            calendarId: updated.calendar_id || null,
          });
        })
        .catch((error) => {
          logger.error("bootstrap", "Erro ao atualizar negocio", error.message);
          sendJson(res, 500, { ok: false });
        });
      return;
    }

    if (req.url === "/business/settings" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          let payload = {};
          try {
            payload = JSON.parse(body || "{}");
          } catch (error) {
            sendJson(res, 400, { ok: false, error: "JSON invalido" });
            return;
          }
          const updated = repos.updateBusinessSettings(payload);
          sendJson(res, 200, {
            ok: true,
            businessId: updated.id,
            settings: safeJson(updated.settings, {}),
          });
        })
        .catch((error) => {
          logger.error("bootstrap", "Erro ao atualizar settings", error.message);
          sendJson(res, 500, { ok: false });
        });
      return;
    }

    if (req.url === "/business/whatsapp" && req.method === "GET") {
      const business = repos.getBusiness();
      const integration = repos.getWhatsappIntegrationByBusinessId(business.id);
      sendJson(res, 200, {
        ok: true,
        businessId: business.id,
        phoneNumber: integration?.phone_number || null,
      });
      return;
    }

    if (req.url === "/business/whatsapp" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          let payload = {};
          try {
            payload = JSON.parse(body || "{}");
          } catch (error) {
            sendJson(res, 400, { ok: false, error: "JSON invalido" });
            return;
          }
          const business = repos.getBusiness();
          if (!payload.phoneNumber) {
            sendJson(res, 400, { ok: false, error: "phoneNumber obrigatorio" });
            return;
          }
          const phoneNumber = String(payload.phoneNumber).replace(/\D/g, "");
          const integration = repos.setWhatsappIntegration(business.id, phoneNumber);
          sendJson(res, 200, {
            ok: true,
            businessId: integration.business_id,
            phoneNumber: integration.phone_number,
          });
        })
        .catch((error) => {
          logger.error("bootstrap", "Erro ao salvar integracao WhatsApp", error.message);
          sendJson(res, 500, { ok: false });
        });
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(env.port, () => {
    logger.info("bootstrap", `HTTP ativo na porta ${env.port}`);
  });

  await startWhatsapp();
}

bootstrap().catch((error) => {
  logger.error("bootstrap", "Falha ao iniciar aplicacao", error);
  process.exit(1);
});
