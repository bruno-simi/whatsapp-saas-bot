const Stripe = require("stripe");
const env = require("../config/env");

const stripe = new Stripe(env.stripeSecretKey || "", {
  apiVersion: "2025-02-24.acacia",
});

module.exports = stripe;
