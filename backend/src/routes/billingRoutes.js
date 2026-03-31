const express = require("express");
const prisma = require("../lib/prisma");
const stripe = require("../lib/stripe");
const env = require("../config/env");
const { createCheckoutSession, syncSubscriptionByStripeId } = require("../services/billingService");
const authMiddleware = require("../middlewares/auth");

const router = express.Router();

router.get("/status", authMiddleware, async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: { businessId: req.user.businessId },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ ok: true, data: subscription });
});

router.post("/subscribe", authMiddleware, async (req, res) => {
  const session = await createCheckoutSession(req.user.businessId);
  return res.json({ ok: true, data: { url: session.url } });
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      env.stripeWebhookSecret
    );
  } catch (error) {
    return res.status(400).json({ ok: false, error: "Assinatura de webhook invalida" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const stripeSubscriptionId = session.subscription;
    const businessId = session.metadata?.businessId;

    const current = await prisma.subscription.findFirst({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    if (current) {
      await prisma.subscription.update({
        where: { id: current.id },
        data: {
          stripeSubscriptionId,
          status: "active",
        },
      });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const stripeSubscriptionId = event.data.object.subscription;
    await syncSubscriptionByStripeId(stripeSubscriptionId, "past_due");
  }

  if (event.type === "customer.subscription.deleted") {
    const stripeSubscriptionId = event.data.object.id;
    await syncSubscriptionByStripeId(stripeSubscriptionId, "canceled");
  }

  if (event.type === "invoice.payment_succeeded") {
    const stripeSubscriptionId = event.data.object.subscription;
    await syncSubscriptionByStripeId(stripeSubscriptionId, "active");
  }

  return res.json({ received: true });
});

module.exports = router;
