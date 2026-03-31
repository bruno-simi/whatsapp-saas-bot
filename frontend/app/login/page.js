"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    businessName: "",
    businessType: "barbearia",
  });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      if (mode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
      }
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="mx-auto mt-16 w-full max-w-md rounded-lg bg-white p-6 shadow">
      <h1 className="mb-4 text-2xl font-semibold">{mode === "login" ? "Login" : "Criar conta"}</h1>
      <form className="space-y-3" onSubmit={submit}>
        <input
          className="w-full rounded border p-2"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="w-full rounded border p-2"
          type="password"
          placeholder="Senha"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {mode === "register" ? (
          <>
            <input
              className="w-full rounded border p-2"
              placeholder="Nome da empresa"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            />
            <select
              className="w-full rounded border p-2"
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            >
              <option value="barbearia">Barbearia</option>
              <option value="oficina">Oficina</option>
              <option value="consultorio">Consultorio</option>
            </select>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button className="w-full rounded bg-slate-900 p-2 text-white" type="submit">
          {mode === "login" ? "Entrar" : "Cadastrar"}
        </button>
      </form>

      <button
        className="mt-4 text-sm text-slate-600 underline"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Nao tem conta? Cadastre-se" : "Ja tem conta? Fazer login"}
      </button>
    </main>
  );
}
