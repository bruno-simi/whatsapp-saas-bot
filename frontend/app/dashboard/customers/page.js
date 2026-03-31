"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  async function load() {
    const response = await apiRequest("/customers");
    setCustomers(response.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCustomer(event) {
    event.preventDefault();
    await apiRequest("/customers", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", phone: "", notes: "" });
    load();
  }

  return (
    <main className="mx-auto mt-8 max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Clientes</h1>

      <form className="mb-6 grid gap-2 rounded bg-white p-4 shadow" onSubmit={createCustomer}>
        <input className="rounded border p-2" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded border p-2" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <textarea className="rounded border p-2" placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="rounded bg-slate-900 p-2 text-white" type="submit">Salvar cliente</button>
      </form>

      <div className="space-y-2">
        {customers.map((customer) => (
          <div key={customer.id} className="rounded bg-white p-3 shadow">
            <p className="font-medium">{customer.name}</p>
            <p className="text-sm text-slate-600">{customer.phone}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
