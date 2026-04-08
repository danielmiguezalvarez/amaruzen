"use client";

import { useEffect, useState } from "react";

type Profesor = { id: string; nombre: string; activo: boolean };
type Sala = { id: string; nombre: string; aforo: number; activa: boolean };

type HorarioLite = {
  id: string;
  diaSemana: string | null;
  horaInicio: string;
  horaFin: string;
  profesorId: string;
  salaId: string;
  profesor: { nombre: string };
  sala: { nombre: string };
};

type Clase = {
  id: string;
  nombre: string;
  profesor: Profesor;
  sala: Sala;
  aforo: number;
  recurrente: boolean;
  fechaFin: string | null;
  color: string | null;
  activa: boolean;
  horarios: HorarioLite[];
};

type HorarioForm = {
  _key: string; // clave local para React, no va a la API
  id: string | null; // null = nuevo, string = existente
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  profesorId: string;
  salaId: string;
};

const PALETA = ["#ef4444", "#f59e0b", "#22c55e", "#14b8a6", "#0ea5e9", "#6366f1", "#ec4899", "#78716c"];
const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const DIAS_ES: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

let _keyCounter = 0;
function newKey() { return String(++_keyCounter); }

function horarioVacio(profesorId: string, salaId: string): HorarioForm {
  return { _key: newKey(), id: null, diaSemana: "LUNES", horaInicio: "09:00", horaFin: "10:00", profesorId, salaId };
}

export default function ClasesPage() {
  const [clases, setClases] = useState<Clase[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Clase | null>(null);

  // Campos base de la clase
  const [form, setForm] = useState({
    nombre: "", tipoNombre: "", profesorId: "", salaId: "",
    aforo: "", fechaFin: "", color: "",
  });
  // Horarios recurrentes
  const [horarios, setHorarios] = useState<HorarioForm[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    setLoading(true);
    const data = await fetch("/api/admin/clases?withFormData=1").then((r) => r.json());
    setClases(Array.isArray(data.clases) ? data.clases : []);
    setProfesores((Array.isArray(data.profesores) ? data.profesores : []).filter((x: Profesor) => x.activo));
    setSalas((Array.isArray(data.salas) ? data.salas : []).filter((x: Sala) => x.activa));
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm({ nombre: "", tipoNombre: "", profesorId: "", salaId: "", aforo: "", fechaFin: "", color: "" });
    setHorarios([]);
    setError("");
    setMensaje("");
    setShowForm(true);
  }

  function abrirEditar(c: Clase) {
    setEditando(c);
    setForm({
      nombre: c.nombre, tipoNombre: "", profesorId: c.profesor.id, salaId: c.sala.id,
      aforo: String(c.aforo),
      fechaFin: c.fechaFin ? new Date(c.fechaFin).toISOString().split("T")[0] : "",
      color: c.color || "",
    });
    // Poblar los horarios existentes
    setHorarios(
      c.horarios.map((h) => ({
        _key: newKey(),
        id: h.id,
        diaSemana: h.diaSemana || "LUNES",
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        profesorId: h.profesorId,
        salaId: h.salaId,
      }))
    );
    setError("");
    setMensaje("");
    setShowForm(true);
  }

  function agregarHorario() {
    const profId = form.profesorId || (profesores[0]?.id ?? "");
    const salaId = form.salaId || (salas[0]?.id ?? "");
    setHorarios((prev) => [...prev, horarioVacio(profId, salaId)]);
  }

  function actualizarHorario(key: string, campo: Partial<HorarioForm>) {
    setHorarios((prev) => prev.map((h) => h._key === key ? { ...h, ...campo } : h));
  }

  function eliminarHorario(key: string) {
    setHorarios((prev) => prev.filter((h) => h._key !== key));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (horarios.length === 0) {
      setError("Añade al menos un horario recurrente.");
      return;
    }
    for (const h of horarios) {
      if (!h.profesorId || !h.salaId) {
        setError("Todos los horarios deben tener profesor y sala.");
        return;
      }
      if (h.horaInicio >= h.horaFin) {
        setError(`Horario del ${DIAS_ES[h.diaSemana]}: la hora de inicio debe ser anterior a la de fin.`);
        return;
      }
    }

    setSaving(true);

    const payload = {
      ...form,
      aforo: Number(form.aforo),
      recurrente: true,
      horarios: horarios.map((h) => ({
        id: h.id,
        diaSemana: h.diaSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        profesorId: h.profesorId,
        salaId: h.salaId,
      })),
    };

    const res = editando
      ? await fetch(`/api/admin/clases/${editando.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/clases", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al guardar");
    } else {
      setShowForm(false);
      if (editando) setMensaje("Clase actualizada. Las sesiones futuras han sido sincronizadas.");
      await cargar();
    }
    setSaving(false);
  }

  async function desactivar(id: string) {
    if (!confirm("¿Desactivar esta clase? Se cancelarán todas las sesiones futuras.")) return;
    await fetch(`/api/admin/clases/${id}`, { method: "DELETE" });
    await cargar();
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
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden md:table-cell">Horarios</th>
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {clases.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {c.color && <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: c.color }} />}
                        <div>
                          <p className="font-medium text-stone-800">{c.nombre}</p>
                          <p className="text-xs text-stone-400">{c.aforo} plazas · {c.profesor.nombre} · {c.sala.nombre}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-stone-600 hidden md:table-cell">
                      {c.horarios.length === 0 ? (
                        <span className="text-red-400 text-xs">Sin horarios</span>
                      ) : (
                        <div className="space-y-0.5">
                          {c.horarios.map((h) => (
                            <div key={h.id} className="text-xs">
                              {h.diaSemana ? DIAS_ES[h.diaSemana] : "Puntual"} {h.horaInicio}–{h.horaFin}
                            </div>
                          ))}
                        </div>
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

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre de la clase</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Tipo / categoría <span className="text-stone-400 font-normal">(opcional)</span>
                </label>
                <input value={form.tipoNombre} onChange={(e) => setForm({ ...form, tipoNombre: e.target.value })}
                  placeholder="Ej: Yoga, Pilates…"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
              </div>

              {/* Profesor por defecto + Sala por defecto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Profesor por defecto</label>
                  <select required value={form.profesorId} onChange={(e) => setForm({ ...form, profesorId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                    <option value="">Selecciona...</option>
                    {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Sala por defecto</label>
                  <select required value={form.salaId} onChange={(e) => setForm({ ...form, salaId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400">
                    <option value="">Selecciona...</option>
                    {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre} ({s.aforo} plazas)</option>)}
                  </select>
                </div>
              </div>

              {/* Aforo + FechaFin */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Aforo máximo</label>
                  <input required type="number" min="1" value={form.aforo} onChange={(e) => setForm({ ...form, aforo: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Fecha fin <span className="text-stone-400 font-normal">(opcional)</span>
                  </label>
                  <input type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Color <span className="text-stone-400 font-normal">(opcional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PALETA.map((col) => (
                    <button key={col} type="button" onClick={() => setForm({ ...form, color: col })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === col ? "border-stone-800 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: col }} />
                  ))}
                  <button type="button" onClick={() => setForm({ ...form, color: "" })}
                    className="px-2 py-1 text-xs border border-stone-300 rounded-lg text-stone-500 hover:bg-stone-50">
                    Sin color
                  </button>
                </div>
              </div>

              {/* ── Horarios recurrentes ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-stone-700">Horarios recurrentes</label>
                  <button type="button" onClick={agregarHorario}
                    className="text-xs px-2 py-1 border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-600">
                    + Añadir horario
                  </button>
                </div>

                {horarios.length === 0 && (
                  <p className="text-xs text-stone-400 py-2">
                    Sin horarios. Pulsa &quot;+ Añadir horario&quot; para definir cuándo se imparte esta clase.
                  </p>
                )}

                <div className="space-y-3">
                  {horarios.map((h) => (
                    <div key={h._key} className="border border-stone-200 rounded-xl p-3 space-y-2 bg-stone-50">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Día</label>
                          <select value={h.diaSemana}
                            onChange={(e) => actualizarHorario(h._key, { diaSemana: e.target.value })}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400">
                            {DIAS.map((d) => <option key={d} value={d}>{DIAS_ES[d]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Inicio</label>
                          <input type="time" value={h.horaInicio}
                            onChange={(e) => actualizarHorario(h._key, { horaInicio: e.target.value })}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400" />
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Fin</label>
                          <input type="time" value={h.horaFin}
                            onChange={(e) => actualizarHorario(h._key, { horaFin: e.target.value })}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Profesor</label>
                          <select value={h.profesorId}
                            onChange={(e) => actualizarHorario(h._key, { profesorId: e.target.value })}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400">
                            <option value="">Selecciona...</option>
                            {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Sala</label>
                          <select value={h.salaId}
                            onChange={(e) => actualizarHorario(h._key, { salaId: e.target.value })}
                            className="w-full px-2 py-1.5 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400">
                            <option value="">Selecciona...</option>
                            {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={() => eliminarHorario(h._key)}
                          className="text-xs text-red-400 hover:text-red-600">
                          Eliminar horario
                        </button>
                      </div>
                    </div>
                  ))}
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
