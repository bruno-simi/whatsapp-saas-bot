const prisma = require("../lib/prisma");
const stripe = require("../lib/stripe");
const env = require("../config/env");

async function createCheckoutSession(businessId) {
  const subscription = await prisma.subscription.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: subscription.stripeCustomerId,
    success_url: `${env.frontendUrl}/dashboard/billing?status=success`,
    cancel_url: `${env.frontendUrl}/dashboard/billing?status=cancel`,
    line_items: [{
      price: env.stripePriceId,
      quantity: 1,
    }],
    metadata: {
      businessId,
    },
  });

  return session;
}

async function syncSubscriptionByStripeId(stripeSubscriptionId, status) {
  const current = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!current) {
    return null;
  }

  return prisma.subscription.update({
    where: { id: current.id },
    data: { status },
  });
}

module.exports = {
  createCheckoutSession,
  syncSubscriptionByStripeId,
};
