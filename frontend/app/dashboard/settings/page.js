"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

export default function SettingsPage() {
  const [form, setForm] = useState({ name: "", type: "", plan: "" });

  useEffect(() => {
    apiRequest("/business/settings").then((response) => setForm(response.data));
  }, []);

  async function save(event) {
    event.preventDefault();
    await apiRequest("/business/settings", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    alert("Configuracoes salvas");
  }

  return (
    <main className="mx-auto mt-8 max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Configuracoes</h1>
      <form className="grid gap-2 rounded bg-white p-4 shadow" onSubmit={save}>
        <input className="rounded border p-2" placeholder="Nome da empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded border p-2" placeholder="Tipo de negocio" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        <input className="rounded border p-2" placeholder="Plano" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
        <button className="rounded bg-slate-900 p-2 text-white" type="submit">Salvar</button>
      </form>
    </main>
  );
}
