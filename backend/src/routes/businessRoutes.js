const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

router.get("/settings", async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.user.businessId },
  });

  return res.json({
    ok: true,
    data: {
      id: business.id,
      name: business.name,
      type: business.type,
      plan: business.plan,
    },
  });
});

router.put("/settings", async (req, res) => {
  const business = await prisma.business.update({
    where: { id: req.user.businessId },
    data: {
      name: req.body.name,
      type: req.body.type,
      plan: req.body.plan,
    },
  });

  return res.json({ ok: true, data: business });
});

module.exports = router;
