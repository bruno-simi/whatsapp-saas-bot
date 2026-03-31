const express = require("express");
const prisma = require("../lib/prisma");
const stripe = require("../lib/stripe");
const env = require("../config/env");
const { hashPassword, comparePassword } = require("../utils/hash");
const { signAuthToken } = require("../utils/jwt");
const { isEmail, requireFields } = require("../utils/validation");
const authMiddleware = require("../middlewares/auth");

const router = express.Router();

function stripeCustomerIdForRegister() {
  const key = (env.stripeSecretKey || "").trim();
  if (key.length > 20 && key.startsWith("sk_")) {
    return null;
  }
  return `cus_local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

router.post("/register", async (req, res) => {
  try {
    const missing = requireFields(req.body, ["email", "password", "businessName", "businessType"]);
    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` });
    }

    const { email, password, businessName, businessType, plan } = req.body;
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Email invalido" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Email ja cadastrado" });
    }

    const passwordHash = await hashPassword(password);
    let stripeCustomerId = stripeCustomerIdForRegister();
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email,
        name: businessName,
        metadata: { businessType },
      });
      stripeCustomerId = stripeCustomer.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          type: businessType,
          plan: plan || "starter",
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "owner",
          businessId: business.id,
        },
      });

      await tx.subscription.create({
        data: {
          businessId: business.id,
          stripeCustomerId,
          status: "inactive",
        },
      });

      return { business, user };
    });

    const token = signAuthToken({
      userId: result.user.id,
      businessId: result.business.id,
      role: result.user.role,
    });

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    });

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        businessId: result.business.id,
      },
    });
  } catch (err) {
    console.error("[auth/register]", err);
    const message =
      err && err.code === "P1001"
        ? "Banco de dados indisponivel. Verifique PostgreSQL e DATABASE_URL."
        : err && err.message
          ? err.message
          : "Erro ao cadastrar";
    return res.status(500).json({ ok: false, error: message });
  }
});

router.post("/login", async (req, res) => {
  const missing = requireFields(req.body, ["email", "password"]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` });
  }

  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user) {
    return res.status(401).json({ ok: false, error: "Credenciais invalidas" });
  }

  const passwordMatches = await comparePassword(req.body.password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ ok: false, error: "Credenciais invalidas" });
  }

  const token = signAuthToken({
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
  });

  res.cookie("access_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24,
  });

  return res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("access_token");
  return res.json({ ok: true });
});

router.get("/me", authMiddleware, async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.user.businessId } });
  return res.json({
    ok: true,
    user: req.user,
    business,
  });
});

module.exports = router;
