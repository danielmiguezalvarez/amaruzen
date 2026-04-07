"use client";

import { useEffect, useState } from "react";

type Profesor = { id: string; nombre: string; activo: boolean };
type Sala = { id: string; nombre: string; aforo: number; activa: boolean };
type Clase = {
  id: string;
  nombre: string;
  profesor: Profesor;
  sala: Sala;
  aforo: number;
  recurrente: boolean;
  diaSemana: string | null;
  horaInicio: string;
  horaFin: string;
  fechaFin: string | null;
  color: string | null;
  activa: boolean;
};

const PALETA = ["#ef4444", "#f59e0b", "#22c55e", "#14b8a6", "#0ea5e9", "#6366f1", "#ec4899", "#78716c"];

const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const DIAS_ES: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

export default function ClasesPage() {
  const [clases, setClases] = useState<Clase[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Clase | null>(null);
  const [form, setForm] = useState({
    nombre: "", tipoNombre: "", profesorId: "", salaId: "", aforo: "",
    recurrente: true, diaSemana: "LUNES", horaInicio: "09:00", horaFin: "10:00",
    fechaFin: "", color: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const [c, p, s] = await Promise.all([
      fetch("/api/admin/clases").then((r) => r.json()),
      fetch("/api/admin/profesores").then((r) => r.json()),
      fetch("/api/admin/salas").then((r) => r.json()),
    ]);
    setClases(c);
    setProfesores(p.filter((p: Profesor) => p.activo));
    setSalas(s.filter((s: Sala) => s.activa));
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm({ nombre: "", tipoNombre: "", profesorId: "", salaId: "", aforo: "", recurrente: true, diaSemana: "LUNES", horaInicio: "09:00", horaFin: "10:00", fechaFin: "", color: "" });
    setError("");
    setShowForm(true);
  }

  function abrirEditar(c: Clase) {
    setEditando(c);
    setForm({
      nombre: c.nombre, tipoNombre: "", profesorId: c.profesor.id, salaId: c.sala.id,
      aforo: String(c.aforo), recurrente: c.recurrente,
      diaSemana: c.diaSemana || "LUNES", horaInicio: c.horaInicio, horaFin: c.horaFin,
      fechaFin: c.fechaFin ? new Date(c.fechaFin).toISOString().split("T")[0] : "",
      color: c.color || "",
    });
    setError("");
    setShowForm(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = editando
      ? await fetch(`/api/admin/clases/${editando.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/admin/clases", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al guardar");
    } else {
      setShowForm(false);
      if (editando) setMensaje("Clase actualizada. Las sesiones futuras han sido sincronizadas.");
      cargar();
    }
    setSaving(false);
  }

  async function desactivar(id: string) {
    if (!confirm("¿Desactivar esta clase?")) return;
    await fetch(`/api/admin/clases/${id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Clases</h1>
          <p className="text-stone-500 text-sm mt-1">Gestión de clases del local</p>
        </div>
        <button onClick={abrirNuevo} className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors">
          Nueva clase
        </button>
      </div>

      {mensaje && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {mensaje}
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {clases.length === 0 ? (
            <p className="px-5 py-10 text-center text-stone-400 text-sm">No hay clases creadas</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Clase</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden md:table-cell">Profesor</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden md:table-cell">Sala</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600">Horario</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {clases.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-stone-800">{c.nombre}</p>
                      <p className="text-xs text-stone-400">{c.aforo} plazas</p>
                    </td>
                    <td className="px-5 py-3 text-stone-600 hidden md:table-cell">{c.profesor.nombre}</td>
                    <td className="px-5 py-3 text-stone-600 hidden md:table-cell">{c.sala.nombre}</td>
                    <td className="px-5 py-3 text-stone-600">
                      {c.recurrente && c.diaSemana ? (
                        <span>{DIAS_ES[c.diaSemana]} {c.horaInicio}-{c.horaFin}</span>
                      ) : (
                        <span>{c.horaInicio}-{c.horaFin}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.activa ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {c.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => abrirEditar(c)} className="text-stone-500 hover:text-stone-800 text-xs">Editar</button>
                      {c.activa && <button onClick={() => desactivar(c.id)} className="text-red-400 hover:text-red-600 text-xs">Desactivar</button>}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-stone-800 mb-5">{editando ? "Editar clase" : "Nueva clase"}</h2>
            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre de la clase</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Tipo / categoría <span className="text-stone-400 font-normal">(opcional)</span></label>
                <input value={form.tipoNombre} onChange={(e) => setForm({ ...form, tipoNombre: e.target.value })}
                  placeholder="Ej: Yoga, Pilates…"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Profesor</label>
                  <select required value={form.profesorId} onChange={(e) => setForm({ ...form, profesorId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                    <option value="">Selecciona...</option>
                    {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Sala</label>
                  <select required value={form.salaId} onChange={(e) => setForm({ ...form, salaId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                    <option value="">Selecciona...</option>
                    {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre} ({s.aforo} plazas)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Color <span className="text-stone-400 font-normal">(opcional)</span></label>
                  <div className="flex flex-wrap gap-2">
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
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Aforo máximo</label>
                <input required type="number" min="1" value={form.aforo} onChange={(e) => setForm({ ...form, aforo: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="recurrente" checked={form.recurrente}
                  onChange={(e) => setForm({ ...form, recurrente: e.target.checked })}
                  className="rounded border-stone-300" />
                <label htmlFor="recurrente" className="text-sm font-medium text-stone-700">Clase recurrente (semanal)</label>
              </div>
              {form.recurrente && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Día de la semana</label>
                    <select value={form.diaSemana} onChange={(e) => setForm({ ...form, diaSemana: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                      {DIAS.map((d) => <option key={d} value={d}>{DIAS_ES[d]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Fecha de fin <span className="text-stone-400 font-normal">(opcional — vacío = indefinida)</span>
                    </label>
                    <input type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Hora inicio</label>
                  <input required type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Hora fin</label>
                  <input required type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50">
                  Cancelar
                </button>
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
