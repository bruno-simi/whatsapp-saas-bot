const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

router.post("/whatsapp", async (req, res) => {
  const phoneNumber = req.body.phoneNumber;

  if (!phoneNumber) {
    return res.status(400).json({ ok: false, error: "phoneNumber obrigatorio" });
  }

  const existing = await prisma.whatsappIntegration.findUnique({
    where: { businessId: req.user.businessId },
  });

  const data = existing
    ? await prisma.whatsappIntegration.update({
        where: { id: existing.id },
        data: { phoneNumber },
      })
    : await prisma.whatsappIntegration.create({
        data: {
          businessId: req.user.businessId,
          phoneNumber,
        },
      });

  return res.json({ ok: true, data });
});

module.exports = router;
