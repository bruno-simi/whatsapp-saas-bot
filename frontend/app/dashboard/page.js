"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";

export default function DashboardPage() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    apiRequest("/auth/me").then(setMe).catch(() => {
      window.location.href = "/login";
    });
  }, []);

  return (
    <main className="mx-auto mt-8 max-w-4xl space-y-6 p-4">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-slate-600">{me?.business?.name || "Carregando..."}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link className="rounded bg-white p-4 shadow" href="/dashboard/customers">Clientes</Link>
        <Link className="rounded bg-white p-4 shadow" href="/dashboard/appointments">Agendamentos</Link>
        <Link className="rounded bg-white p-4 shadow" href="/dashboard/settings">Configuracoes</Link>
        <Link className="rounded bg-white p-4 shadow" href="/dashboard/billing">Billing</Link>
      </div>
    </main>
  );
}
