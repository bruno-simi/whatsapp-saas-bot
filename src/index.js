const http = require("http");
const env = require("./config/env");
const logger = require("./utils/logger");
const { runMigrations } = require("./database/migrations");
const { startWhatsapp } = require("./services/whatsappService");

async function bootstrap() {
  runMigrations();
  logger.info("bootstrap", "SQLite inicializado");

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
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
