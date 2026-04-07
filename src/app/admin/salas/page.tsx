"use client";

import { useEffect, useState } from "react";

type Sala = {
  id: string;
  nombre: string;
  descripcion: string | null;
  aforo: number;
  color: string | null;
  activa: boolean;
};

const PALETA = ["#ef4444", "#f59e0b", "#22c55e", "#14b8a6", "#0ea5e9", "#6366f1", "#ec4899", "#78716c"];

export default function SalasPage() {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Sala | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", aforo: "", color: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    const res = await fetch("/api/admin/salas");
    const data = await res.json();
    setSalas(data);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm({ nombre: "", descripcion: "", aforo: "", color: "" });
    setError("");
    setShowForm(true);
  }

  function abrirEditar(sala: Sala) {
    setEditando(sala);
    setForm({ nombre: sala.nombre, descripcion: sala.descripcion || "", aforo: String(sala.aforo), color: sala.color || "" });
    setError("");
    setShowForm(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = editando
      ? await fetch(`/api/admin/salas/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/admin/salas", {
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
    if (!confirm("¿Desactivar esta sala?")) return;
    await fetch(`/api/admin/salas/${id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Salas</h1>
          <p className="text-stone-500 text-sm mt-1">Gestión de salas del local</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
        >
          Nueva sala
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {salas.length === 0 ? (
            <p className="px-5 py-10 text-center text-stone-400 text-sm">No hay salas creadas</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Descripción</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Aforo</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {salas.map((sala) => (
                  <tr key={sala.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 font-medium text-stone-800">
                      <span
                        className="inline-flex items-center gap-2"
                        style={sala.color ? { color: sala.color } : undefined}
                      >
                        {sala.nombre}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-stone-500 hidden sm:table-cell">{sala.descripcion || "—"}</td>
                    <td className="px-5 py-3 text-stone-700">{sala.aforo}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sala.activa ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {sala.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => abrirEditar(sala)} className="text-stone-500 hover:text-stone-800 text-xs">Editar</button>
                      {sala.activa && (
                        <button onClick={() => desactivar(sala.id)} className="text-red-400 hover:text-red-600 text-xs">Desactivar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-5">
              {editando ? "Editar sala" : "Nueva sala"}
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
                <label className="block text-sm font-medium text-stone-700 mb-1">Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Aforo máximo</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.aforo}
                  onChange={(e) => setForm({ ...form, aforo: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Color de sala (opcional)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PALETA.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-6 h-6 rounded-full border ${form.color === c ? "ring-2 ring-stone-800" : "border-stone-300"}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, color: "" })}
                    className="px-2 py-1 text-xs border border-stone-300 rounded"
                  >
                    Sin color
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
