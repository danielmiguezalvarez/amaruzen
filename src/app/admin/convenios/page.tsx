"use client";

import { useEffect, useState } from "react";

type Clase = { id: string; nombre: string; profesor: { nombre: string } };
type Convenio = {
  id: string;
  claseA: Clase;
  claseB: Clase;
  tipo: "EQUIVALENTE" | "EXCEPCIONAL";
  limiteMensual: number;
  requiereAprobacion: boolean;
  activo: boolean;
};

export default function ConveniosPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ claseAId: "", claseBId: "", tipo: "EQUIVALENTE", limiteMensual: "2", requiereAprobacion: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    const [cv, cl] = await Promise.all([
      fetch("/api/admin/convenios").then((r) => r.json()),
      fetch("/api/admin/clases").then((r) => r.json()),
    ]);
    setConvenios(cv);
    setClases(cl.filter((c: any) => c.activa));
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/convenios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Error al guardar");
    } else {
      setShowForm(false);
      cargar();
    }
    setSaving(false);
  }

  async function desactivar(id: string) {
    if (!confirm("¿Desactivar este convenio?")) return;
    await fetch(`/api/admin/convenios/${id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Convenios</h1>
          <p className="text-stone-500 text-sm mt-1">Define qué clases son intercambiables entre sí</p>
        </div>
        <button onClick={() => { setForm({ claseAId: "", claseBId: "", tipo: "EQUIVALENTE", limiteMensual: "2", requiereAprobacion: false }); setError(""); setShowForm(true); }}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors">
          Nuevo convenio
        </button>
      </div>

      {loading ? <p className="text-stone-400 text-sm">Cargando...</p> : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {convenios.length === 0 ? (
            <p className="px-5 py-10 text-center text-stone-400 text-sm">No hay convenios definidos</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Clase A</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Clase B</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Límite/mes</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Aprobación</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {convenios.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-stone-800">{c.claseA.nombre}</p>
                      <p className="text-xs text-stone-400">{c.claseA.profesor.nombre}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-stone-800">{c.claseB.nombre}</p>
                      <p className="text-xs text-stone-400">{c.claseB.profesor.nombre}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.tipo === "EQUIVALENTE" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {c.tipo === "EQUIVALENTE" ? "Equivalente" : "Excepcional"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-stone-600 hidden sm:table-cell">{c.limiteMensual}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className={`text-xs ${c.requiereAprobacion ? "text-amber-600 font-medium" : "text-stone-400"}`}>
                        {c.requiereAprobacion ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.activo && <button onClick={() => desactivar(c.id)} className="text-red-400 hover:text-red-600 text-xs">Desactivar</button>}
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
            <h2 className="text-lg font-semibold text-stone-800 mb-5">Nuevo convenio</h2>
            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Clase A</label>
                <select required value={form.claseAId} onChange={(e) => setForm({ ...form, claseAId: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                  <option value="">Selecciona...</option>
                  {clases.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.profesor.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Clase B</label>
                <select required value={form.claseBId} onChange={(e) => setForm({ ...form, claseBId: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                  <option value="">Selecciona...</option>
                  {clases.filter((c) => c.id !== form.claseAId).map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.profesor.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                  <option value="EQUIVALENTE">Equivalente — más permisivo</option>
                  <option value="EXCEPCIONAL">Excepcional — más restrictivo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Límite de cambios por mes</label>
                <input required type="number" min="1" value={form.limiteMensual}
                  onChange={(e) => setForm({ ...form, limiteMensual: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>
              {form.tipo === "EXCEPCIONAL" && (
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="aprobacion" checked={form.requiereAprobacion}
                    onChange={(e) => setForm({ ...form, requiereAprobacion: e.target.checked })}
                    className="rounded border-stone-300" />
                  <label htmlFor="aprobacion" className="text-sm font-medium text-stone-700">Requiere aprobación del gestor</label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50">
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
