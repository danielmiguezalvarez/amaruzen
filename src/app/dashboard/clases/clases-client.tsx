"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Sesion = { id: string; fecha: Date; horaInicio: string; horaFin: string };
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

type Inscripcion = {
  id: string;
  clase: {
    id: string;
    nombre: string;
    profesor: { nombre: string };
    sala: { nombre: string };
    diaSemana: string | null;
    horaInicio: string;
    horaFin: string;
    recurrente: boolean;
  };
  sesiones: Sesion[];
};

const DIAS_ES: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

export default function ClasesClient({ inscripciones }: { inscripciones: Inscripcion[] }) {
  const router = useRouter();
  const [sesionSeleccionada, setSesionSeleccionada] = useState<Sesion | null>(null);
  const [opciones, setOpciones] = useState<{ mismaClase: SesionDisponible[]; convenio: SesionDisponible[] } | null>(null);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState("");

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
    }
    setEnviando(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Mis clases</h1>
        <p className="text-stone-500 text-sm mt-1">Clases a las que estás inscrito</p>
      </div>

      {exito && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{exito}</div>
      )}

      {inscripciones.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-5 py-12 text-center text-stone-400 text-sm">
          No estás inscrito a ninguna clase todavía. Contacta con el centro para inscribirte.
        </div>
      ) : (
        <div className="space-y-4">
          {inscripciones.map((insc) => (
            <div key={insc.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-stone-800">{insc.clase.nombre}</h2>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {insc.clase.profesor.nombre} · {insc.clase.sala.nombre}
                    </p>
                    {insc.clase.recurrente && insc.clase.diaSemana && (
                      <p className="text-sm text-stone-500">
                        {DIAS_ES[insc.clase.diaSemana]} · {insc.clase.horaInicio} - {insc.clase.horaFin}
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Inscrito</span>
                </div>
              </div>

              {insc.sesiones.length > 0 && (
                <div className="divide-y divide-stone-100">
                  {insc.sesiones.map((sesion) => (
                    <div key={sesion.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-stone-700">
                          {new Date(sesion.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <p className="text-xs text-stone-400">{sesion.horaInicio} - {sesion.horaFin}</p>
                      </div>
                      <button
                        onClick={() => abrirCambio(sesion)}
                        className="text-sm text-stone-600 border border-stone-300 px-3 py-1 rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        No puedo ir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
              Clase del <strong>{new Date(sesionSeleccionada.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</strong> a las <strong>{sesionSeleccionada.horaInicio}</strong>
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
