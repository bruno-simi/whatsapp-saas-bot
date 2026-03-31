"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

export default function BillingPage() {
  const [subscription, setSubscription] = useState(null);

  async function loadStatus() {
    const response = await apiRequest("/billing/status");
    setSubscription(response.data);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function subscribe() {
    const response = await apiRequest("/billing/subscribe", { method: "POST" });
    window.location.href = response.data.url;
  }

  return (
    <main className="mx-auto mt-8 max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <div className="rounded bg-white p-4 shadow">
        <p><strong>Plano atual:</strong> {subscription?.status || "inactive"}</p>
        <p className="mb-4 text-sm text-slate-600">Status da assinatura recorrente Stripe.</p>
        <button className="rounded bg-slate-900 p-2 text-white" onClick={subscribe}>Assinar agora</button>
      </div>
    </main>
  );
}
