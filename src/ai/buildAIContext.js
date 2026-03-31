const env = require("../config/env");
const repos = require("../database/repositories");
const { getContext } = require("./contextStore");

function safeJson(input, fallback = {}) {
  try {
    return JSON.parse(input || "{}");
  } catch (error) {
    return fallback;
  }
}

function buildAIContext(user, incomingText) {
  const memoryContext = getContext(user.phone);
  const customer = repos.findOrCreateCustomer(user.phone, { name: user.name || null });
  const business = repos.getBusiness();
  const subscription = repos.getActiveSubscription();
  const businessSettings = safeJson(business?.settings, {});
  const lastAppointments = repos.listRecentAppointmentsByCustomer(customer.id, 3);

  return {
    ...memoryContext,
    phone: user.phone,
    businessType: (business?.type || env.businessType || "barbearia").toLowerCase(),
    businessName: business?.name || "Negocio",
    businessId: business?.id || env.tenantId,
    currentState: user.state,
    lastMessages: [...(memoryContext.lastMessages || []), incomingText].slice(-6),
    customerHistory: {
      name: customer.name || user.name || null,
      lastService: customer.last_service || null,
      lastVisit: customer.last_visit || null,
      notes: customer.notes || null,
    },
    lastAppointments: lastAppointments.map((item) => ({
      service: item.service,
      startAt: item.start_at,
      status: item.status,
    })),
    preferences: {
      services: businessSettings.services || [],
      serviceDurations: businessSettings.serviceDurations || {},
      openingHours: businessSettings.openingHours || null,
    },
    subscription: subscription
      ? { plan: subscription.plan_code, status: subscription.status }
      : { plan: "starter", status: "trial" },
    collectedData: {
      ...(memoryContext.collectedData || {}),
      name: user.name || customer.name || null,
    },
  };
}

module.exports = {
  buildAIContext,
};
