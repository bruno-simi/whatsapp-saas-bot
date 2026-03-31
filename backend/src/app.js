const express = require("express");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const customerRoutes = require("./routes/customerRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const businessRoutes = require("./routes/businessRoutes");
const integrationRoutes = require("./routes/integrationRoutes");
const templateRoutes = require("./routes/templateRoutes");
const authMiddleware = require("./middlewares/auth");
const subscriptionMiddleware = require("./middlewares/subscription");

const app = express();

app.use(cookieParser());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", env.frontendUrl);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use((req, res, next) => {
  if (req.originalUrl === "/billing/webhook") {
    return next();
  }
  return express.json()(req, res, next);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/billing", billingRoutes);
app.use(authMiddleware);
app.use(subscriptionMiddleware);
app.use("/customers", customerRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/business", businessRoutes);
app.use("/integrations", integrationRoutes);
app.use("/templates", templateRoutes);

app.use((error, _req, res, _next) => {
  return res.status(500).json({ ok: false, error: error.message || "Erro interno" });
});

module.exports = app;
