"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customerId: "", service: "", datetime: "" });

  async function load() {
    const [appointmentsResponse, customersResponse] = await Promise.all([
      apiRequest("/appointments"),
      apiRequest("/customers"),
    ]);

    setAppointments(appointmentsResponse.data);
    setCustomers(customersResponse.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createAppointment(event) {
    event.preventDefault();
    await apiRequest("/appointments", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm({ customerId: "", service: "", datetime: "" });
    load();
  }

  return (
    <main className="mx-auto mt-8 max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Agenda</h1>

      <form className="mb-6 grid gap-2 rounded bg-white p-4 shadow" onSubmit={createAppointment}>
        <select className="rounded border p-2" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
          <option value="">Selecione um cliente</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </select>
        <input className="rounded border p-2" placeholder="Servico" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
        <input className="rounded border p-2" type="datetime-local" value={form.datetime} onChange={(e) => setForm({ ...form, datetime: e.target.value })} />
        <button className="rounded bg-slate-900 p-2 text-white" type="submit">Criar agendamento</button>
      </form>

      <div className="space-y-2">
        {appointments.map((appointment) => (
          <div key={appointment.id} className="rounded bg-white p-3 shadow">
            <p className="font-medium">{appointment.service}</p>
            <p className="text-sm text-slate-600">{new Date(appointment.datetime).toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
