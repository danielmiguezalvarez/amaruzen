"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import CalendarioGrid from "@/components/CalendarioGrid";
import CalendarioLista from "@/components/CalendarioLista";
import type { EventoCalendario, SalaLite } from "@/components/calendario-types";
import { getLunesLocal, toLocalYMD } from "@/components/calendario-utils";

type Sesion = {
  id: string;
  sesionId: string | null;
  horarioId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  esInscrito: boolean;
  esBono?: boolean;
  clase: {
    id: string;
    nombre: string;
    color?: string | null;
    profesor: { nombre: string };
    sala: { id: string; nombre: string; color?: string | null };
  };
};

type BonoAlumno = {
  id: string;
  claseId: string;
  claseNombre: string;
  profesorNombre: string;
  creditosIniciales: number;
  creditosDisponibles: number;
  usosActivos: number;
};

type SesionDisponible = {
  id: string;
  fecha: Date | string;
  horaInicio: string;
  horaFin: string;
  clase: { nombre: string; profesor: { nombre: string }; sala: { nombre: string } };
  tipoConvenio: "EQUIVALENTE" | "EXCEPCIONAL" | null;
  convenioId?: string;
  requiereAprobacion?: boolean;
};

type Reserva = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sala: { id: string; nombre: string; color?: string | null };
  profesional: { name: string | null };
};

// Determina si una sesión tiene bono disponible para el alumno
function getBonoParaSesion(sesion: Sesion, bonosPorClase: Map<string, BonoAlumno>): BonoAlumno | null {
  return bonosPorClase.get(sesion.clase.id) ?? null;
}

// Calcula el motivo por el que no se puede inscribir con bono
function motivoNoPuedeInscribirse(
  sesion: Sesion,
  bono: BonoAlumno | null,
  ahora: Date
): string | null {
  if (!bono) return null; // no tiene bono de esta clase
  if (sesion.cancelada) return "La sesión está cancelada.";
  const fechaSesion = new Date(sesion.fecha);
  const [h, m] = sesion.horaInicio.split(":").map(Number);
  fechaSesion.setHours(h, m, 0, 0);
  if (fechaSesion <= ahora) return "La sesión ya ha comenzado o pasado.";
  if (sesion.esBono) return null; // ya inscrito con bono → puede cancelar
  if (sesion.esInscrito) return "Ya estás inscrito en esta sesión por horario regular.";
  if (bono.creditosDisponibles <= 0) return "No te quedan créditos en el bono.";
  return null; // puede inscribirse
}

export default function ClasesClient() {
  const router = useRouter();
  const [lunes, setLunes] = useState<Date>(() => getLunesLocal(new Date()));
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [salas, setSalas] = useState<SalaLite[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal sesión (bono + cambio de horario)
  const [sesionSeleccionada, setSesionSeleccionada] = useState<Sesion | null>(null);
  // Pestaña activa del modal: "bono" | "cambio"
  const [modalTab, setModalTab] = useState<"bono" | "cambio">("bono");

  // Cambio de horario
  const [opciones, setOpciones] = useState<{ mismaClase: SesionDisponible[]; convenio: SesionDisponible[] } | null>(null);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Bono en modal
  const [bonoAccion, setBonoAccion] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [bonoMensaje, setBonoMensaje] = useState("");

  const [exito, setExito] = useState("");
  const [bonos, setBonos] = useState<BonoAlumno[]>([]);

  const cargar = useCallback(async (lunesDate: Date) => {
    setLoading(true);
    const res = await fetch(`/api/alumno/sesiones/semana?fecha=${toLocalYMD(lunesDate)}`);
    if (res.ok) {
      const data = await res.json();
      setSesiones(data.sesiones);
      setSalas(data.salas || []);
      setReservas(data.reservas || []);
    }
    const bonosRes = await fetch("/api/alumno/bono");
    if (bonosRes.ok) {
      const bonosData = await bonosRes.json();
      setBonos(Array.isArray(bonosData) ? bonosData : []);
    } else {
      setBonos([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(lunes); }, [lunes, cargar]);

  function semanaAnterior() {
    setLunes((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  }
  function semanaSiguiente() {
    setLunes((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  }
  function hoyEnRango() {
    return getLunesLocal(new Date()).getTime() === lunes.getTime();
  }

  const ahora = new Date();

  const bonosPorClase = useMemo(() => {
    const map = new Map<string, BonoAlumno>();
    for (const b of bonos) map.set(b.claseId, b);
    return map;
  }, [bonos]);

  // ── Acciones de bono ────────────────────────────────────────────────────────

  async function reservarConBono(sesion: Sesion) {
    const ref = sesion.sesionId || `${sesion.horarioId}__${toLocalYMD(new Date(sesion.fecha))}`;
    setBonoAccion("loading");
    setBonoMensaje("");
    const res = await fetch("/api/alumno/bono", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sesionId: ref }),
    });
    const d = await res.json();
    if (!res.ok) {
      setBonoAccion("error");
      setBonoMensaje(d.error || "No se pudo reservar con bono.");
      return;
    }
    setBonoAccion("ok");
    setBonoMensaje("Reserva con bono realizada correctamente.");
    await cargar(lunes);
  }

  async function cancelarConBono(sesion: Sesion) {
    const ref = sesion.sesionId || `${sesion.horarioId}__${toLocalYMD(new Date(sesion.fecha))}`;
    setBonoAccion("loading");
    setBonoMensaje("");
    const res = await fetch("/api/alumno/bono", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sesionId: ref }),
    });
    const d = await res.json();
    if (!res.ok) {
      setBonoAccion("error");
      setBonoMensaje(d.error || "No se pudo cancelar la reserva de bono.");
      return;
    }
    setBonoAccion("ok");
    setBonoMensaje("Reserva cancelada. Crédito devuelto.");
    await cargar(lunes);
  }

  // ── Apertura del modal ───────────────────────────────────────────────────────

  async function abrirModal(sesion: Sesion) {
    const bono = getBonoParaSesion(sesion, bonosPorClase);
    const puedeInscribirse = bono && !sesion.esInscrito && !sesion.cancelada;
    const tieneInscripcionRegular = sesion.esInscrito && !sesion.esBono;

    // Decide pestaña por defecto
    const tabInicial: "bono" | "cambio" = bono ? "bono" : "cambio";

    setSesionSeleccionada(sesion);
    setModalTab(tabInicial);
    setOpciones(null);
    setBonoAccion("idle");
    setBonoMensaje("");
    setExito("");

    // Si tiene inscripción regular (no bono), pre-cargar opciones de cambio
    if (tieneInscripcionRegular) {
      setLoadingOpciones(true);
      const origenRef = sesion.sesionId || `${sesion.horarioId}__${toLocalYMD(new Date(sesion.fecha))}`;
      try {
        const res = await fetch(`/api/alumno/sesiones?sesionOrigenId=${encodeURIComponent(origenRef)}`);
        if (res.ok) {
          const data = await res.json();
          setOpciones(data);
        } else {
          setOpciones({ mismaClase: [], convenio: [] });
        }
      } catch {
        setOpciones({ mismaClase: [], convenio: [] });
      } finally {
        setLoadingOpciones(false);
      }
    }

    // Suprimir advertencia de variable no usada
    void puedeInscribirse;
  }

  function cerrarModal() {
    setSesionSeleccionada(null);
    setOpciones(null);
    setBonoAccion("idle");
    setBonoMensaje("");
  }

  async function solicitarCambio(destino: SesionDisponible) {
    if (!sesionSeleccionada) return;
    setEnviando(true);
    const res = await fetch("/api/alumno/cambios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sesionOrigenId: sesionSeleccionada.sesionId || `${sesionSeleccionada.horarioId}__${toLocalYMD(new Date(sesionSeleccionada.fecha))}`,
        sesionDestinoId: destino.id,
        convenioId: destino.convenioId || null,
      }),
    });
    if (res.ok) {
      const cambio = await res.json();
      const msg = cambio.estado === "APROBADO"
        ? "Cambio realizado correctamente."
        : "Solicitud enviada. El gestor la revisará en breve.";
      setExito(msg);
      cerrarModal();
      router.refresh();
      cargar(lunes);
    }
    setEnviando(false);
  }

  // ── Click en el calendario ───────────────────────────────────────────────────

  function onClickEvento(ev: EventoCalendario) {
    if (ev.tipo !== "CLASE") return;
    const s = ev.raw as Sesion;
    if (s.cancelada) return;

    const bono = getBonoParaSesion(s, bonosPorClase);
    const tieneInscripcionRegular = s.esInscrito && !s.esBono;

    // Abrir modal si tiene bono para esa clase O si está inscrito por horario regular
    if (!bono && !tieneInscripcionRegular) return;

    // Para inscripción regular, solo abrir si la sesión es futura
    if (tieneInscripcionRegular && !bono) {
      const fechaSesion = new Date(s.fecha);
      const [h, m] = s.horaInicio.split(":").map(Number);
      fechaSesion.setHours(h, m, 0, 0);
      if (fechaSesion <= ahora) return;
    }

    abrirModal(s);
  }

  // ── Eventos para el calendario ───────────────────────────────────────────────

  const eventos: EventoCalendario[] = [
    ...sesiones.map((s) => {
      const bono = getBonoParaSesion(s, bonosPorClase);
      return {
        id: s.id,
        tipo: "CLASE" as const,
        fecha: s.fecha,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        salaId: s.clase.sala.id,
        salaNombre: s.clase.sala.nombre,
        titulo: s.clase.nombre,
        subtitulo: s.clase.profesor.nombre,
        cancelada: s.cancelada,
        esInscrito: s.esInscrito,
        // Marca extra: tiene bono disponible (para diferenciarlo visualmente si se quiere)
        tieneBono: !!bono,
        color: s.clase.color || null,
        raw: s,
      };
    }),
    ...reservas.map((r) => ({
      id: `reserva_${r.id}`,
      tipo: "RESERVA" as const,
      fecha: r.fecha,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      salaId: r.sala.id,
      salaNombre: r.sala.nombre,
      titulo: "Reserva",
      subtitulo: r.profesional.name || "Profesional",
      raw: r,
    })),
  ];

  const diasSemana: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });
  const domingo = diasSemana[6];
  const labelSemana = `${lunes.getDate()} ${lunes.toLocaleString("es-ES", { month: "short" })} – ${domingo.getDate()} ${domingo.toLocaleString("es-ES", { month: "short", year: "numeric" })}`;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Mis clases</h1>
        <p className="text-stone-500 text-sm mt-1">Vista semanal de tus sesiones</p>
      </div>

      {exito && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{exito}</div>
      )}

      {/* Resumen de bonos */}
      {bonos.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <h2 className="font-semibold text-stone-800 mb-2">Mis bonos</h2>
          <ul className="space-y-2">
            {bonos.map((b) => (
              <li key={b.id} className="text-sm text-stone-700 bg-stone-50 rounded-lg px-3 py-2 flex items-center justify-between">
                <span>
                  <span className="font-medium">{b.claseNombre}</span>
                  <span className="text-stone-500"> · {b.profesorNombre}</span>
                </span>
                <span className={`font-semibold ${b.creditosDisponibles > 0 ? "text-emerald-700" : "text-red-500"}`}>
                  {b.creditosDisponibles}/{b.creditosIniciales} créditos
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-400 mt-2">Pulsa una sesión del calendario para inscribirte con bono.</p>
        </div>
      )}

      {/* Navegación semana */}
      <div className="flex items-center gap-2">
        <button onClick={semanaAnterior}
          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600">
          ‹
        </button>
        <span className="text-sm font-medium text-stone-700 min-w-[180px] text-center">{labelSemana}</span>
        <button onClick={semanaSiguiente}
          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600">
          ›
        </button>
        {!hoyEnRango() && (
          <button onClick={() => setLunes(getLunesLocal(new Date()))}
            className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors text-stone-600">
            Hoy
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400 text-sm">Cargando sesiones...</div>
      ) : (
        <>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 text-xs text-stone-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-200 border-l-2 border-emerald-600 inline-block" />
              Mis clases
            </span>
            {bonos.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-violet-200 border-l-2 border-violet-600 inline-block" />
                Puedo apuntarme con bono
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-stone-200 border border-stone-300 inline-block" />
              Otras clases
            </span>
          </div>

          <CalendarioGrid lunes={lunes} salas={salas} eventos={eventos} onClickEvento={onClickEvento} />
          <CalendarioLista lunes={lunes} eventos={eventos} onClickEvento={onClickEvento} />
        </>
      )}

      {/* ── Modal de sesión ─────────────────────────────────────────────────── */}
      {sesionSeleccionada && (() => {
        const s = sesionSeleccionada;
        const bono = getBonoParaSesion(s, bonosPorClase);
        const tieneInscripcionRegular = s.esInscrito && !s.esBono;
        const mostrarTabs = !!bono && tieneInscripcionRegular;

        const fechaSesion = new Date(s.fecha);
        const [hh, mm] = s.horaInicio.split(":").map(Number);
        fechaSesion.setHours(hh, mm, 0, 0);
        const esFutura = fechaSesion > ahora;

        const motivo = motivoNoPuedeInscribirse(s, bono, ahora);
        const puedeInscribirse = bono && !motivo && !s.esBono;
        const puedeCancelarBono = s.esBono && esFutura && new Date() < new Date(fechaSesion.getTime() - 2 * 60 * 60 * 1000);

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              {/* Cabecera */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-stone-800">
                  {s.clase.nombre}
                </h2>
                <button onClick={cerrarModal} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
              </div>

              {/* Info sesión */}
              <div className="bg-stone-50 rounded-lg p-3 mb-4 text-sm text-stone-600">
                {new Date(s.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · <strong>{s.horaInicio} – {s.horaFin}</strong> · {s.clase.sala.nombre}
                <span className="ml-2 text-stone-400">({s.clase.profesor.nombre})</span>
              </div>

              {/* Tabs si tiene bono Y inscripción regular */}
              {mostrarTabs && (
                <div className="flex border-b border-stone-200 mb-4">
                  <button
                    onClick={() => setModalTab("bono")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${modalTab === "bono" ? "border-violet-600 text-violet-700" : "border-transparent text-stone-500 hover:text-stone-700"}`}
                  >
                    Bono
                  </button>
                  <button
                    onClick={() => setModalTab("cambio")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${modalTab === "cambio" ? "border-violet-600 text-violet-700" : "border-transparent text-stone-500 hover:text-stone-700"}`}
                  >
                    Cambio de horario
                  </button>
                </div>
              )}

              {/* ── Pestaña BONO ── */}
              {bono && (!mostrarTabs || modalTab === "bono") && (
                <div className="space-y-3">
                  {/* Info bono */}
                  <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-violet-800 font-medium">{bono.claseNombre}</span>
                    <span className={`text-sm font-semibold ${bono.creditosDisponibles > 0 ? "text-emerald-700" : "text-red-500"}`}>
                      {bono.creditosDisponibles}/{bono.creditosIniciales} créditos
                    </span>
                  </div>

                  {/* Mensaje feedback */}
                  {bonoAccion === "ok" && (
                    <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{bonoMensaje}</div>
                  )}
                  {bonoAccion === "error" && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bonoMensaje}</div>
                  )}

                  {/* Ya inscrito con bono */}
                  {s.esBono && (
                    <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      Ya estás inscrito en esta sesión con tu bono.
                    </div>
                  )}

                  {/* Motivo por el que no puede inscribirse */}
                  {motivo && !s.esBono && (
                    <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {motivo}
                    </div>
                  )}

                  {/* Botones de acción */}
                  {bonoAccion !== "ok" && (
                    <>
                      {puedeInscribirse && (
                        <button
                          onClick={() => reservarConBono(s)}
                          disabled={bonoAccion === "loading"}
                          className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        >
                          {bonoAccion === "loading" ? "Inscribiendo..." : "Inscribirme con bono"}
                        </button>
                      )}
                      {puedeCancelarBono && (
                        <button
                          onClick={() => cancelarConBono(s)}
                          disabled={bonoAccion === "loading"}
                          className="w-full py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors"
                        >
                          {bonoAccion === "loading" ? "Cancelando..." : "Cancelar inscripción de bono"}
                        </button>
                      )}
                      {s.esBono && !puedeCancelarBono && (
                        <p className="text-xs text-stone-400 text-center">
                          Solo puedes cancelar con al menos 2 horas de antelación. Si necesitas cancelar, habla con el admin.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Pestaña CAMBIO DE HORARIO ── */}
              {tieneInscripcionRegular && (!mostrarTabs || modalTab === "cambio") && (
                <div>
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-800">
                      Solo puedes cambiar con al menos 2 horas de antelación. Si falta menos tiempo, habla con el admin.
                    </p>
                  </div>

                  {loadingOpciones ? (
                    <p className="text-sm text-stone-400 py-4 text-center">Buscando opciones disponibles...</p>
                  ) : opciones ? (
                    <div className="space-y-5">
                      {opciones.mismaClase.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-stone-700 mb-2">Misma clase, otro horario</h3>
                          <div className="space-y-2">
                            {opciones.mismaClase.map((dest) => (
                              <button key={dest.id} onClick={() => solicitarCambio(dest)} disabled={enviando}
                                className="w-full text-left p-3 border border-stone-200 rounded-lg hover:border-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50">
                                <p className="text-sm font-medium text-stone-800">
                                  {new Date(dest.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                                </p>
                                <p className="text-xs text-stone-500">{dest.horaInicio} - {dest.horaFin} · {dest.clase.sala.nombre}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {opciones.convenio.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-stone-700 mb-2">Clases equivalentes</h3>
                          <div className="space-y-2">
                            {opciones.convenio.map((dest) => (
                              <button key={dest.id} onClick={() => solicitarCambio(dest)} disabled={enviando}
                                className="w-full text-left p-3 border border-stone-200 rounded-lg hover:border-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-stone-800">{dest.clase.nombre}</p>
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${dest.tipoConvenio === "EXCEPCIONAL" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                    {dest.tipoConvenio === "EXCEPCIONAL" ? "Excepcional" : "Equivalente"}
                                  </span>
                                  {dest.requiereAprobacion && (
                                    <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">Requiere aprobación</span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-500">
                                  {new Date(dest.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {dest.horaInicio} - {dest.horaFin}
                                </p>
                                <p className="text-xs text-stone-400">{dest.clase.profesor.nombre} · {dest.clase.sala.nombre}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {opciones.mismaClase.length === 0 && opciones.convenio.length === 0 && (
                        <p className="text-sm text-stone-400 text-center py-4">
                          No hay sesiones disponibles para cambiarte en este momento.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400 text-center py-4">No se pudieron cargar las opciones.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
