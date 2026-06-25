"use client";

import { useEffect, useState } from "react";

type Festivo = {
  id: string;
  fecha: string;
  nombre: string;
  activo: boolean;
};

export default function FestivosPage() {
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState("");
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/admin/festivos");
    if (res.ok) {
      const data = await res.json();
      setFestivos(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crearFestivo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/festivos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, nombre }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear el festivo");
      setSaving(false);
      return;
    }

    setFecha("");
    setNombre("");
    setSaving(false);
    await cargar();
  }

  async function eliminarFestivo(id: string) {
    if (!confirm("¿Eliminar este festivo?")) return;
    const res = await fetch(`/api/admin/festivos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar el festivo");
      return;
    }
    await cargar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Festivos</h1>
        <p className="text-stone-500 text-sm mt-1">Gestiona cierres del centro por día completo.</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <h2 className="text-sm font-semibold text-stone-800 mb-3">Añadir festivo</h2>
        {error && <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        <form onSubmit={crearFestivo} className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Fecha</label>
            <input
              required
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Nombre</label>
            <input
              required
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Navidad"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Añadir festivo"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {loading ? (
          <p className="px-5 py-8 text-sm text-stone-400">Cargando festivos...</p>
        ) : festivos.length === 0 ? (
          <p className="px-5 py-8 text-sm text-stone-400">No hay festivos creados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-stone-600">Fecha</th>
                <th className="text-left px-5 py-3 font-medium text-stone-600">Nombre</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {festivos.map((f) => (
                <tr key={f.id}>
                  <td className="px-5 py-3 text-stone-700">{new Date(f.fecha).toLocaleDateString("es-ES")}</td>
                  <td className="px-5 py-3 text-stone-800 font-medium">{f.nombre}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => eliminarFestivo(f.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
