"use client";

import { useEffect, useMemo, useState } from "react";

type HorarioClase = {
  id: string;
  diaSemana: string | null;
  fecha: string | null;
  horaInicio: string;
  horaFin: string;
  sala: { nombre: string };
  profesor: { nombre: string };
};

type Inscripcion = {
  id: string;
  numClases: number;
  clase: { id: string; nombre: string; profesor: { nombre: string } };
  horarios: Array<{ horario: HorarioClase }>;
};

type Alumno = {
  id: string;
  name: string | null;
  email: string;
  activo: boolean;
  accesoActivo?: boolean;
  inscripciones: Inscripcion[];
};

type Clase = {
  id: string;
  nombre: string;
  profesor: { nombre: string };
  activa: boolean;
  horarios: HorarioClase[];
};

const DIA_ES: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

function labelHorario(h: HorarioClase) {
  if (h.fecha) {
    return `${new Date(h.fecha).toLocaleDateString("es-ES")} · ${h.horaInicio}-${h.horaFin} · ${h.sala.nombre}`;
  }
  return `${DIA_ES[h.diaSemana || ""] || ""} · ${h.horaInicio}-${h.horaFin} · ${h.sala.nombre}`;
}

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
  const [numClases, setNumClases] = useState("1");
  const [horariosSel, setHorariosSel] = useState<string[]>([]);

  async function cargar() {
    const [a, c] = await Promise.all([
      fetch("/api/admin/alumnos").then((r) => r.json()),
      fetch("/api/admin/clases").then((r) => r.json()),
    ]);
    setAlumnos(a);
    setClases(c.filter((x: Clase) => x.activa));
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function refrescarDetalle(alumnoId: string) {
    const updated = await fetch("/api/admin/alumnos").then((r) => r.json());
    setAlumnos(updated);
    setDetalle(updated.find((a: Alumno) => a.id === alumnoId) || null);
  }

  async function crearAlumno(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/alumnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: false }),
    });
    cargar();
    setDetalle(null);
  }

  async function reactivarAlumno(id: string) {
    if (!confirm("¿Reactivar este alumno?")) return;
    await fetch(`/api/admin/alumnos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    await refrescarDetalle(id);
  }

  async function invitarAlumno(id: string) {
    const res = await fetch(`/api/admin/alumnos/${id}/invitar`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "No se pudo enviar invitación");
      return;
    }
    alert("Invitación enviada por email");
    await refrescarDetalle(id);
  }

  async function anadirInscripcion(alumnoId: string) {
    if (!claseAnadir || horariosSel.length === 0) return;
    const res = await fetch(`/api/admin/alumnos/${alumnoId}/inscripciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claseId: claseAnadir,
        numClases: Number(numClases) || horariosSel.length,
        horarioIds: horariosSel,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "No se pudo guardar la inscripción");
      return;
    }

    setClaseAnadir("");
    setNumClases("1");
    setHorariosSel([]);
    await refrescarDetalle(alumnoId);
  }

  async function quitarInscripcion(alumnoId: string, claseId: string) {
    if (!confirm("¿Quitar esta inscripción?")) return;
    await fetch(`/api/admin/alumnos/${alumnoId}/inscripciones`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claseId }),
    });
    await refrescarDetalle(alumnoId);
  }

  const clasesNoInscritas = useMemo(() => {
    if (!detalle) return [];
    return clases.filter((c) => !detalle.inscripciones.some((i) => i.clase.id === c.id));
  }, [clases, detalle]);

  const claseSeleccionada = useMemo(
    () => clases.find((c) => c.id === claseAnadir) || null,
    [claseAnadir, clases]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Alumnos</h1>
          <p className="text-stone-500 text-sm mt-1">{alumnos.filter((a) => a.activo).length} alumnos activos</p>
        </div>
        <button
          onClick={() => {
            setForm({ nombre: "", email: "", password: "" });
            setError("");
            setShowForm(true);
          }}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
        >
          Nuevo alumno
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Cargando...</p>
      ) : (
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
                  <th className="text-left px-5 py-3 font-medium text-stone-600 hidden sm:table-cell">Acceso</th>
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
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.accesoActivo ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {a.accesoActivo ? "Con acceso" : "Sin acceso"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.activo ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {a.activo ? "Activo" : "Baja"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDetalle(a)} className="text-stone-500 hover:text-stone-800 text-xs">
                        Ver detalle
                      </button>
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
            <h2 className="text-lg font-semibold text-stone-800 mb-5">Nuevo alumno</h2>
            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <form onSubmit={crearAlumno} className="space-y-4">
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
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña (opcional)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Dejar vacío para definirla más tarde"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
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
                  {saving ? "Guardando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-stone-800">{detalle.name || "Sin nombre"}</h2>
                <p className="text-sm text-stone-500">{detalle.email}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">
                &times;
              </button>
            </div>

            <div className="mb-5">
              <h3 className="text-sm font-medium text-stone-700 mb-3">Clases inscritas</h3>
              {detalle.inscripciones.length === 0 ? (
                <p className="text-sm text-stone-400">Sin inscripciones activas</p>
              ) : (
                <ul className="space-y-3">
                  {detalle.inscripciones.map((i) => (
                    <li key={i.id} className="bg-stone-50 rounded-lg px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-stone-800">{i.clase.nombre}</p>
                          <p className="text-xs text-stone-500">
                            {i.clase.profesor.nombre} · {i.horarios.length}/{i.numClases} horarios
                          </p>
                        </div>
                        <button
                          onClick={() => quitarInscripcion(detalle.id, i.clase.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Quitar
                        </button>
                      </div>
                      {i.horarios.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {i.horarios.map((h) => (
                            <li key={h.horario.id} className="text-xs text-stone-600">
                              {labelHorario(h.horario)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {clasesNoInscritas.length > 0 && (
              <div className="mb-5 border border-stone-200 rounded-lg p-3">
                <h3 className="text-sm font-medium text-stone-700 mb-2">Añadir a clase y horarios</h3>
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Clase</label>
                    <select
                      value={claseAnadir}
                      onChange={(e) => {
                        setClaseAnadir(e.target.value);
                        setHorariosSel([]);
                      }}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    >
                      <option value="">Selecciona una clase...</option>
                      {clasesNoInscritas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} — {c.profesor.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Veces por semana/contrato</label>
                    <input
                      type="number"
                      min="1"
                      value={numClases}
                      onChange={(e) => setNumClases(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {claseSeleccionada && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-stone-600 mb-1">Selecciona horarios</p>
                    <div className="space-y-1 max-h-44 overflow-auto border border-stone-100 rounded p-2">
                      {claseSeleccionada.horarios.length === 0 ? (
                        <p className="text-xs text-stone-400">Esta clase aún no tiene horarios</p>
                      ) : (
                        claseSeleccionada.horarios.map((h) => (
                          <label key={h.id} className="flex items-start gap-2 text-sm text-stone-700">
                            <input
                              type="checkbox"
                              checked={horariosSel.includes(h.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setHorariosSel((prev) => [...prev, h.id]);
                                } else {
                                  setHorariosSel((prev) => prev.filter((id) => id !== h.id));
                                }
                              }}
                            />
                            <span>{labelHorario(h)}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => anadirInscripcion(detalle.id)}
                  disabled={!claseAnadir || horariosSel.length === 0}
                  className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
                >
                  Guardar inscripción
                </button>
              </div>
            )}

            {detalle.activo && (
              <button
                onClick={() => darDeBaja(detalle.id)}
                className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
              >
                Dar de baja
              </button>
            )}

            {!detalle.activo && (
              <button
                onClick={() => reactivarAlumno(detalle.id)}
                className="w-full py-2 border border-emerald-300 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50"
              >
                Reactivar alumno
              </button>
            )}

            <button
              onClick={() => invitarAlumno(detalle.id)}
              className="w-full mt-2 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50"
            >
              Enviar invitación de acceso
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
