"use client";

import { useEffect, useState } from "react";

type Profesor = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  user?: { id: string; activo: boolean } | null;
  accesoActivo?: boolean;
};

export default function ProfesoresPage() {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Profesor | null>(null);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function cargar() {
    const res = await fetch("/api/admin/profesores");
    const data = await res.json();
    setProfesores(data);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm({ nombre: "", email: "", telefono: "", password: "" });
    setShowPassword(false);
    setError("");
    setShowForm(true);
  }

  function abrirEditar(p: Profesor) {
    setEditando(p);
    setForm({ nombre: p.nombre, email: p.email || "", telefono: p.telefono || "", password: "" });
    setShowPassword(false);
    setError("");
    setShowForm(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = editando
      ? await fetch(`/api/admin/profesores/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/admin/profesores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al guardar");
    } else {
      setShowForm(false);
      cargar();
    }
    setSaving(false);
  }

  async function desactivar(id: string) {
    if (!confirm("¿Desactivar este profesor?")) return;
    const res = await fetch(`/api/admin/profesores/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      const clases = Array.isArray(data.clases) && data.clases.length > 0
        ? `\nClases activas: ${data.clases.join(", ")}`
        : "";
      alert((data.error || "No se pudo desactivar") + clases);
      return;
    }
    cargar();
  }

  async function reactivar(id: string) {
    if (!confirm("¿Reactivar este profesor?")) return;
    await fetch(`/api/admin/profesores/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    cargar();
  }

  async function invitar(id: string) {
    const res = await fetch(`/api/admin/profesores/${id}/invitar`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "No se pudo enviar invitación");
      return;
    }
    alert("Invitación enviada por email");
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Profesores</h1>
          <p className="text-stone-500 text-sm mt-1">Gestión de profesores del local</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
        >
          Nuevo profesor
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {profesores.length === 0 ? (
            <p className="px-5 py-10 text-center text-stone-400 text-sm">No hay profesores creados</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Email</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Teléfono</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Acceso</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {profesores.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 font-medium text-stone-800">{p.nombre}</td>
                    <td className="px-5 py-3 text-stone-500 hidden sm:table-cell">{p.email || "—"}</td>
                    <td className="px-5 py-3 text-stone-500 hidden sm:table-cell">{p.telefono || "—"}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.accesoActivo ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {p.accesoActivo ? "Con acceso" : "Sin acceso"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.activo ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => abrirEditar(p)} className="text-stone-500 hover:text-stone-800 text-xs">Editar</button>
                      <button
                        onClick={() => invitar(p.id)}
                        disabled={!p.email}
                        title={!p.email ? "Añade un email para enviar invitación" : "Enviar invitación"}
                        className="text-blue-600 hover:text-blue-700 text-xs disabled:text-stone-300 disabled:cursor-not-allowed"
                      >
                        Invitar
                      </button>
                      {p.activo && (
                        <button onClick={() => desactivar(p.id)} className="text-red-400 hover:text-red-600 text-xs">Desactivar</button>
                      )}
                      {!p.activo && (
                        <button onClick={() => reactivar(p.id)} className="text-emerald-600 hover:text-emerald-700 text-xs">Reactivar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-5">
              {editando ? "Editar profesor" : "Nuevo profesor"}
            </h2>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña inicial (opcional)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Si queda vacío, activará por invitación"
                    className="w-full px-3 py-2 pr-20 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-700"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
