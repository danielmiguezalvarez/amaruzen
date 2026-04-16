"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegistroPage() {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    tipo: "ALUMNO",
    mensaje: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOk(false);

    const res = await fetch("/api/solicitud-alta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(data.error || "No se pudo enviar la solicitud");
      return;
    }

    setOk(true);
    setForm({ nombre: "", email: "", telefono: "", tipo: "ALUMNO", mensaje: "" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-800">Amaruzen</h1>
          <p className="text-stone-500 mt-1">Solicitud de alta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">Solicitar acceso</h2>
          <p className="text-sm text-stone-500 mb-6">El equipo revisará tu solicitud y te enviará una invitación por email.</p>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          {ok && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">Solicitud enviada correctamente.</div>}

          <form onSubmit={enviar} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre completo</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono (opcional)</label>
              <input
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Tipo de alta</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              >
                <option value="ALUMNO">Alumno</option>
                <option value="PROFESIONAL">Profesional</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Mensaje (opcional)</label>
              <textarea
                value={form.mensaje}
                onChange={(e) => setForm((f) => ({ ...f, mensaje: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm min-h-24"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            ¿Ya tienes acceso?{" "}
            <Link href="/login" className="text-stone-800 font-medium hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
