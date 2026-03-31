const express = require("express");
const prisma = require("../lib/prisma");
const { requireFields } = require("../utils/validation");

const router = express.Router();

router.get("/", async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    where: { businessId: req.user.businessId },
    include: { customer: true },
    orderBy: { datetime: "asc" },
  });

  return res.json({ ok: true, data: appointments });
});

router.post("/", async (req, res) => {
  const missing = requireFields(req.body, ["customerId", "service", "datetime"]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` });
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: req.body.customerId,
      businessId: req.user.businessId,
    },
  });

  if (!customer) {
    return res.status(404).json({ ok: false, error: "Cliente nao encontrado" });
  }

  const appointment = await prisma.appointment.create({
    data: {
      businessId: req.user.businessId,
      customerId: customer.id,
      service: req.body.service,
      datetime: new Date(req.body.datetime),
      status: req.body.status || "scheduled",
    },
  });

  return res.status(201).json({ ok: true, data: appointment });
});

module.exports = router;
