const express = require("express");
const prisma = require("../lib/prisma");
const { requireFields } = require("../utils/validation");

const router = express.Router();

function interpolate(content, variables) {
  return content.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function getMissingTemplateVariables(content, variables) {
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  const uniqueKeys = [...new Set(matches.map((item) => item.replace(/[{}]/g, "")))];
  return uniqueKeys.filter((key) => variables[key] === undefined || variables[key] === null);
}

async function getBusinessContext(businessId) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, type: true },
  });
}

async function resolveTemplateForBusiness({ businessId, businessType, groupSlug, templateName }) {
  const group = await prisma.templateGroup.findUnique({
    where: { slug: groupSlug },
    select: { id: true, slug: true },
  });

  if (!group) {
    return null;
  }

  const scopes = [
    { scope: "business", businessId },
    { scope: "segment", businessType },
    { scope: "global" },
  ];

  for (const scopeWhere of scopes) {
    const template = await prisma.template.findFirst({
      where: {
        groupId: group.id,
        channel: "whatsapp",
        isActive: true,
        ...scopeWhere,
        ...(templateName ? { name: templateName } : {}),
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (template && template.versions.length) {
      return {
        template,
        version: template.versions[0],
      };
    }
  }

  return null;
}

async function getTemplateByIdForBusiness(templateId, businessId, businessType) {
  return prisma.template.findFirst({
    where: {
      id: templateId,
      OR: [{ scope: "global" }, { scope: "segment", businessType }, { scope: "business", businessId }],
    },
    include: {
      group: true,
      versions: {
        orderBy: { version: "desc" },
      },
    },
  });
}

router.get("/", async (req, res) => {
  const business = await getBusinessContext(req.user.businessId);
  const templates = await prisma.template.findMany({
    where: {
      channel: "whatsapp",
      OR: [
        { scope: "global" },
        { scope: "segment", businessType: business.type },
        { scope: "business", businessId: req.user.businessId },
      ],
    },
    include: {
      group: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: [{ scope: "asc" }, { updatedAt: "desc" }],
  });

  return res.json({ ok: true, data: templates });
});

router.post("/", async (req, res) => {
  const missing = requireFields(req.body, ["groupSlug", "name", "content"]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` });
  }

  const group = await prisma.templateGroup.findUnique({
    where: { slug: req.body.groupSlug },
  });

  if (!group) {
    return res.status(404).json({ ok: false, error: "Grupo de template nao encontrado" });
  }

  const template = await prisma.template.create({
    data: {
      businessId: req.user.businessId,
      groupId: group.id,
      name: req.body.name,
      scope: "business",
      channel: "whatsapp",
      isActive: true,
      versions: {
        create: {
          version: 1,
          content: req.body.content,
          variablesJson: req.body.variables || {},
          approvalStatus: "draft",
          createdBy: req.user.id,
        },
      },
      events: {
        create: {
          action: "template_created",
          actorId: req.user.id,
          payload: {
            groupSlug: req.body.groupSlug,
          },
        },
      },
    },
    include: {
      versions: true,
      group: true,
    },
  });

  return res.status(201).json({ ok: true, data: template });
});

router.post("/:id/clone-to-business", async (req, res) => {
  const business = await getBusinessContext(req.user.businessId);
  const sourceTemplate = await getTemplateByIdForBusiness(req.params.id, req.user.businessId, business.type);

  if (!sourceTemplate || !sourceTemplate.versions.length) {
    return res.status(404).json({ ok: false, error: "Template nao encontrado" });
  }

  const latest = sourceTemplate.versions[0];
  const cloned = await prisma.template.create({
    data: {
      businessId: req.user.businessId,
      groupId: sourceTemplate.groupId,
      name: req.body.name || sourceTemplate.name,
      scope: "business",
      channel: sourceTemplate.channel,
      isActive: true,
      versions: {
        create: {
          version: 1,
          content: latest.content,
          variablesJson: latest.variablesJson || {},
          approvalStatus: "draft",
          createdBy: req.user.id,
        },
      },
      events: {
        create: {
          action: "template_cloned",
          actorId: req.user.id,
          payload: {
            sourceTemplateId: sourceTemplate.id,
          },
        },
      },
    },
    include: {
      versions: true,
      group: true,
    },
  });

  return res.status(201).json({ ok: true, data: cloned });
});

router.post("/:id/versions", async (req, res) => {
  const missing = requireFields(req.body, ["content"]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` });
  }

  const template = await prisma.template.findFirst({
    where: {
      id: req.params.id,
      businessId: req.user.businessId,
      scope: "business",
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!template) {
    return res.status(404).json({ ok: false, error: "Template nao encontrado" });
  }

  const lastVersion = template.versions[0]?.version || 0;
  const createdVersion = await prisma.templateVersion.create({
    data: {
      templateId: template.id,
      version: lastVersion + 1,
      content: req.body.content,
      variablesJson: req.body.variables || {},
      approvalStatus: req.body.approvalStatus || "draft",
      createdBy: req.user.id,
    },
  });

  await prisma.templateEvent.create({
    data: {
      templateId: template.id,
      action: "template_version_created",
      actorId: req.user.id,
      payload: { version: createdVersion.version },
    },
  });

  return res.status(201).json({ ok: true, data: createdVersion });
});

router.post("/:id/activate", async (req, res) => {
  const template = await prisma.template.findFirst({
    where: {
      id: req.params.id,
      businessId: req.user.businessId,
      scope: "business",
    },
  });

  if (!template) {
    return res.status(404).json({ ok: false, error: "Template nao encontrado" });
  }

  const updated = await prisma.template.update({
    where: { id: template.id },
    data: { isActive: true },
  });

  await prisma.templateEvent.create({
    data: {
      templateId: template.id,
      action: "template_activated",
      actorId: req.user.id,
    },
  });

  return res.json({ ok: true, data: updated });
});

router.post("/messages/send-template", async (req, res) => {
  const missing = requireFields(req.body, ["to", "groupSlug"]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` });
  }

  const business = await getBusinessContext(req.user.businessId);
  const resolved = await resolveTemplateForBusiness({
    businessId: req.user.businessId,
    businessType: business.type,
    groupSlug: req.body.groupSlug,
    templateName: req.body.templateName,
  });

  if (!resolved) {
    return res.status(404).json({ ok: false, error: "Template nao encontrado para o contexto atual" });
  }

  const variables = req.body.variables || {};
  const missingVariables = getMissingTemplateVariables(resolved.version.content, variables);
  if (missingVariables.length) {
    return res.status(400).json({
      ok: false,
      error: `Variaveis obrigatorias ausentes: ${missingVariables.join(", ")}`,
    });
  }

  const renderedText = interpolate(resolved.version.content, variables);
  const payload = {
    messaging_product: "whatsapp",
    to: req.body.to,
    type: "template",
    template: {
      name: resolved.template.name,
      language: {
        code: req.body.languageCode || "pt_BR",
      },
      components: [
        {
          type: "body",
          parameters: Object.keys(variables).map((key) => ({
            type: "text",
            text: String(variables[key]),
          })),
        },
      ],
    },
    preview_text: renderedText,
  };

  await prisma.templateEvent.create({
    data: {
      templateId: resolved.template.id,
      action: "template_payload_generated",
      actorId: req.user.id,
      payload: {
        to: req.body.to,
      },
    },
  });

  return res.json({
    ok: true,
    data: {
      resolvedScope: resolved.template.scope,
      templateId: resolved.template.id,
      templateVersion: resolved.version.version,
      payload,
    },
  });
});

module.exports = router;
