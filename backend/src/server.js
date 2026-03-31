const env = require("./config/env");
const app = require("./app");

app.listen(env.port, () => {
  console.log(`[backend] API SaaS ativa na porta ${env.port}`);
});
