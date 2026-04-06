"use client";

import { useEffect, useState } from "react";

type Inscripcion = { id: string; clase: { id: string; nombre: string; profesor: { nombre: string } } };
type Alumno = {
  id: string;
  name: string | null;
  email: string;
  activo: boolean;
  inscripciones: Inscripcion[];
};
type Clase = { id: string; nombre: string; profesor: { nombre: string }; activa: boolean };

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detalle, setDetalle] = useState<Alumno | null>(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [claseAnadir, setClaseAnadir] = useState("");

  async function cargar() {
    const [a, c] = await Promise.all([
      fetch("/api/admin/alumnos").then((r) => r.json()),
      fetch("/api/admin/clases").then((r) => r.json()),
    ]);
    setAlumnos(a);
    setClases(c.filter((c: Clase) => c.activa));
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  async function crearAlumno(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/alumnos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Error al crear");
    } else {
      setShowForm(false);
      cargar();
    }
    setSaving(false);
  }

  async function darDeBaja(id: string) {
    if (!confirm("¿Dar de baja a este alumno? Se eliminarán todas sus inscripciones activas.")) return;
    await fetch(`/api/admin/alumnos/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: false }),
    });
    cargar();
    setDetalle(null);
  }

  async function anadirInscripcion(alumnoId: string) {
    if (!claseAnadir) return;
    const res = await fetch(`/api/admin/alumnos/${alumnoId}/inscripciones`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claseId: claseAnadir }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
    } else {
      setClaseAnadir("");
      cargar();
      // Actualizar detalle
      const updated = await fetch("/api/admin/alumnos").then((r) => r.json());
      setAlumnos(updated);
      setDetalle(updated.find((a: Alumno) => a.id === alumnoId) || null);
    }
  }

  async function quitarInscripcion(alumnoId: string, claseId: string) {
    if (!confirm("¿Quitar esta inscripción?")) return;
    await fetch(`/api/admin/alumnos/${alumnoId}/inscripciones`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claseId }),
    });
    cargar();
    const updated = await fetch("/api/admin/alumnos").then((r) => r.json());
    setAlumnos(updated);
    setDetalle(updated.find((a: Alumno) => a.id === alumnoId) || null);
  }

  const clasesNoInscritas = detalle
    ? clases.filter((c) => !detalle.inscripciones.some((i) => i.clase.id === c.id))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Alumnos</h1>
          <p className="text-stone-500 text-sm mt-1">{alumnos.filter((a) => a.activo).length} alumnos activos</p>
        </div>
        <button onClick={() => { setForm({ nombre: "", email: "", password: "" }); setError(""); setShowForm(true); }}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors">
          Nuevo alumno
        </button>
      </div>

      {loading ? <p className="text-stone-400 text-sm">Cargando...</p> : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {alumnos.length === 0 ? (
            <p className="px-5 py-10 text-center text-stone-400 text-sm">No hay alumnos registrados</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Alumno</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Email</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Clases</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {alumnos.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 font-medium text-stone-800">{a.name || "Sin nombre"}</td>
                    <td className="px-5 py-3 text-stone-500 hidden sm:table-cell">{a.email}</td>
                    <td className="px-5 py-3 text-stone-600">{a.inscripciones.length}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.activo ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {a.activo ? "Activo" : "Baja"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDetalle(a)} className="text-stone-500 hover:text-stone-800 text-xs">Ver detalle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal nuevo alumno */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-5">Nuevo alumno</h2>
            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <form onSubmit={crearAlumno} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña (opcional)</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Dejar vacío si usará Google"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50">
                  {saving ? "Guardando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalle alumno */}
      {detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-stone-800">{detalle.name || "Sin nombre"}</h2>
                <p className="text-sm text-stone-500">{detalle.email}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
            </div>

            <div className="mb-5">
              <h3 className="text-sm font-medium text-stone-700 mb-3">Clases inscritas</h3>
              {detalle.inscripciones.length === 0 ? (
                <p className="text-sm text-stone-400">Sin inscripciones activas</p>
              ) : (
                <ul className="space-y-2">
                  {detalle.inscripciones.map((i) => (
                    <li key={i.id} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-stone-800">{i.clase.nombre}</p>
                        <p className="text-xs text-stone-500">{i.clase.profesor.nombre}</p>
                      </div>
                      <button onClick={() => quitarInscripcion(detalle.id, i.clase.id)}
                        className="text-xs text-red-400 hover:text-red-600">Quitar</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {clasesNoInscritas.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-medium text-stone-700 mb-2">Añadir a clase</h3>
                <div className="flex gap-2">
                  <select value={claseAnadir} onChange={(e) => setClaseAnadir(e.target.value)}
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                    <option value="">Selecciona una clase...</option>
                    {clasesNoInscritas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} — {c.profesor.nombre}</option>
                    ))}
                  </select>
                  <button onClick={() => anadirInscripcion(detalle.id)}
                    className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700">
                    Añadir
                  </button>
                </div>
              </div>
            )}

            {detalle.activo && (
              <button onClick={() => darDeBaja(detalle.id)}
                className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
                Dar de baja
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
