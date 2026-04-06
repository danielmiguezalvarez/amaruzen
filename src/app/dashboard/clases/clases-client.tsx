"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Sesion = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  clase: {
    id: string;
    nombre: string;
    profesor: { nombre: string };
    sala: { nombre: string };
  };
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

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLunesLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function ClasesClient() {
  const router = useRouter();
  const [lunes, setLunes] = useState<Date>(() => getLunesLocal(new Date()));
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);

  // Swap modal state
  const [sesionSeleccionada, setSesionSeleccionada] = useState<Sesion | null>(null);
  const [opciones, setOpciones] = useState<{ mismaClase: SesionDisponible[]; convenio: SesionDisponible[] } | null>(null);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState("");

  const cargar = useCallback(async (lunesDate: Date) => {
    setLoading(true);
    const res = await fetch(`/api/alumno/sesiones/semana?fecha=${toLocalYMD(lunesDate)}`);
    if (res.ok) {
      const data = await res.json();
      setSesiones(data.sesiones);
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

  async function abrirCambio(sesion: Sesion) {
    setSesionSeleccionada(sesion);
    setOpciones(null);
    setExito("");
    setLoadingOpciones(true);
    const res = await fetch(`/api/alumno/sesiones?sesionOrigenId=${sesion.id}`);
    const data = await res.json();
    setOpciones(data);
    setLoadingOpciones(false);
  }

  async function solicitarCambio(destino: SesionDisponible) {
    if (!sesionSeleccionada) return;
    setEnviando(true);
    const res = await fetch("/api/alumno/cambios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sesionOrigenId: sesionSeleccionada.id,
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
      setSesionSeleccionada(null);
      setOpciones(null);
      router.refresh();
      cargar(lunes);
    }
    setEnviando(false);
  }

  const diasSemana: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });

  const porDia: Record<string, Sesion[]> = {};
  diasSemana.forEach((d) => { porDia[toLocalYMD(d)] = []; });
  sesiones.forEach((s) => {
    const localKey = toLocalYMD(new Date(s.fecha));
    if (porDia[localKey] !== undefined) porDia[localKey].push(s);
  });

  const domingo = diasSemana[6];
  const labelSemana = `${lunes.getDate()} ${lunes.toLocaleString("es-ES", { month: "short" })} – ${domingo.getDate()} ${domingo.toLocaleString("es-ES", { month: "short", year: "numeric" })}`;
  const hoy = toLocalYMD(new Date());
  const ahora = new Date();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Mis clases</h1>
        <p className="text-stone-500 text-sm mt-1">Vista semanal de tus sesiones</p>
      </div>

      {exito && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{exito}</div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {diasSemana.map((dia, i) => {
            const key = toLocalYMD(dia);
            const esHoy = key === hoy;
            const sesionesDia = porDia[key] ?? [];

            return (
              <div key={key} className={`rounded-xl border overflow-hidden ${esHoy ? "border-stone-500" : "border-stone-200"}`}>
                <div className={`px-3 py-2 text-center ${esHoy ? "bg-stone-800 text-white" : "bg-stone-50 text-stone-600"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide">{DIAS[i]}</p>
                  <p className={`text-lg font-bold leading-tight ${esHoy ? "text-white" : "text-stone-800"}`}>
                    {dia.getDate()}
                  </p>
                </div>
                <div className="bg-white divide-y divide-stone-100 min-h-[80px]">
                  {sesionesDia.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-stone-300 text-center">Sin sesiones</p>
                  ) : (
                    sesionesDia.map((s) => {
                      const fechaSesion = new Date(s.fecha);
                      const [h, m] = s.horaInicio.split(":").map(Number);
                      fechaSesion.setHours(h, m, 0, 0);
                      const yaEmpezó = fechaSesion <= ahora;

                      return (
                        <div key={s.id} className={`px-3 py-2 ${s.cancelada ? "opacity-40" : ""}`}>
                          <p className="text-xs font-semibold text-stone-800 leading-tight">{s.clase.nombre}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{s.horaInicio} - {s.horaFin}</p>
                          <p className="text-xs text-stone-400">{s.clase.sala.nombre}</p>
                          {s.cancelada ? (
                            <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">Cancelada</span>
                          ) : !yaEmpezó ? (
                            <button
                              onClick={() => abrirCambio(s)}
                              className="mt-1.5 w-full text-xs text-stone-600 border border-stone-300 px-2 py-1 rounded hover:bg-stone-50 transition-colors"
                            >
                              No puedo ir
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de cambio */}
      {sesionSeleccionada && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-stone-800">Cambiar sesión</h2>
              <button onClick={() => { setSesionSeleccionada(null); setOpciones(null); }}
                className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
            </div>

            <div className="bg-stone-50 rounded-lg p-3 mb-5 text-sm text-stone-600">
              <strong>{sesionSeleccionada.clase.nombre}</strong> —{" "}
              {new Date(sesionSeleccionada.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} a las <strong>{sesionSeleccionada.horaInicio}</strong>
            </div>

            {loadingOpciones ? (
              <p className="text-sm text-stone-400 py-4 text-center">Buscando opciones disponibles...</p>
            ) : opciones ? (
              <div className="space-y-5">
                {opciones.mismaClase.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-stone-700 mb-2">Misma clase, otro horario</h3>
                    <div className="space-y-2">
                      {opciones.mismaClase.map((s) => (
                        <button key={s.id} onClick={() => solicitarCambio(s)} disabled={enviando}
                          className="w-full text-left p-3 border border-stone-200 rounded-lg hover:border-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50">
                          <p className="text-sm font-medium text-stone-800">
                            {new Date(s.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                          </p>
                          <p className="text-xs text-stone-500">{s.horaInicio} - {s.horaFin} · {s.clase.sala.nombre}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {opciones.convenio.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-stone-700 mb-2">Clases equivalentes</h3>
                    <div className="space-y-2">
                      {opciones.convenio.map((s) => (
                        <button key={s.id} onClick={() => solicitarCambio(s)} disabled={enviando}
                          className="w-full text-left p-3 border border-stone-200 rounded-lg hover:border-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-stone-800">{s.clase.nombre}</p>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${s.tipoConvenio === "EXCEPCIONAL" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                              {s.tipoConvenio === "EXCEPCIONAL" ? "Excepcional" : "Equivalente"}
                            </span>
                            {s.requiereAprobacion && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">Requiere aprobación</span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500">
                            {new Date(s.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {s.horaInicio} - {s.horaFin}
                          </p>
                          <p className="text-xs text-stone-400">{s.clase.profesor.nombre} · {s.clase.sala.nombre}</p>
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
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
