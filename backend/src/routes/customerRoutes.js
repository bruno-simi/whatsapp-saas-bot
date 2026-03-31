const express = require("express");
const prisma = require("../lib/prisma");
const { requireFields } = require("../utils/validation");

const router = express.Router();

router.get("/", async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { businessId: req.user.businessId },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ ok: true, data: customers });
});

router.post("/", async (req, res) => {
  const missing = requireFields(req.body, ["name", "phone"]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` });
  }

  const customer = await prisma.customer.create({
    data: {
      businessId: req.user.businessId,
      name: req.body.name,
      phone: req.body.phone,
      notes: req.body.notes || null,
    },
  });

  return res.status(201).json({ ok: true, data: customer });
});

router.put("/:id", async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: req.params.id,
      businessId: req.user.businessId,
    },
  });

  if (!customer) {
    return res.status(404).json({ ok: false, error: "Cliente nao encontrado" });
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name: req.body.name ?? customer.name,
      phone: req.body.phone ?? customer.phone,
      notes: req.body.notes ?? customer.notes,
    },
  });

  return res.json({ ok: true, data: updated });
});

module.exports = router;
