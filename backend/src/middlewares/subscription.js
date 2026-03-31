const prisma = require("../lib/prisma");

async function subscriptionMiddleware(req, res, next) {
  const subscription = await prisma.subscription.findFirst({
    where: { businessId: req.user.businessId },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription || subscription.status !== "active") {
    return res.status(402).json({ ok: false, error: "Assinatura inativa" });
  }

  return next();
}

module.exports = subscriptionMiddleware;
