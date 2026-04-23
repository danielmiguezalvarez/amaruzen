"use client";

import type React from "react";
import { buildWeekDays, toLocalYMD } from "@/components/calendario-utils";
import type { EventoCalendario } from "@/components/calendario-types";

type Props = {
  lunes: Date;
  eventos: EventoCalendario[];
  onClickEvento?: (evento: EventoCalendario) => void;
  onEliminarEvento?: (evento: EventoCalendario) => void;
};

const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

export default function CalendarioLista({ lunes, eventos, onClickEvento, onEliminarEvento }: Props) {
  const dias = buildWeekDays(lunes);

  const porDia: Record<string, EventoCalendario[]> = {};
  dias.forEach((d) => {
    porDia[toLocalYMD(d)] = [];
  });

  eventos.forEach((ev) => {
    const key = toLocalYMD(new Date(ev.fecha));
    if (porDia[key]) porDia[key].push(ev);
  });

  Object.values(porDia).forEach((list) => list.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));

  return (
    <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
      {dias.map((dia, i) => {
        const key = toLocalYMD(dia);
        const lista = porDia[key] || [];
        return (
          <div key={key} className="rounded-xl border border-stone-200 overflow-hidden bg-white">
            <div className="px-3 py-2 bg-stone-50 border-b border-stone-100 text-center">
              <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">{DIAS[i]}</p>
              <p className="text-lg font-bold text-stone-800 leading-tight">{dia.getDate()}</p>
            </div>

            <div className="divide-y divide-stone-100 min-h-[72px]">
              {lista.length === 0 ? (
                <p className="px-3 py-4 text-xs text-stone-300 text-center">Sin eventos</p>
              ) : (
                  lista.map((ev) => {
                    // Colores por prioridad: inscrito > bono > color propio > gris
                    let badge: string;
                    let stripe: React.CSSProperties | undefined;

                    if (ev.tipo === "RESERVA") {
                      badge = "bg-blue-100 text-blue-700";
                      stripe = undefined;
                    } else if (ev.cancelada) {
                      badge = "bg-red-100 text-red-700";
                      stripe = undefined;
                    } else if (ev.esInscrito) {
                      badge = "bg-emerald-100 text-emerald-700";
                      stripe = { borderLeft: "4px solid #059669" };
                    } else if (ev.tieneBono) {
                      badge = "bg-violet-100 text-violet-700";
                      stripe = { borderLeft: "4px solid #7c3aed" };
                    } else if (ev.color && ev.tipo === "CLASE") {
                      badge = "bg-stone-100 text-stone-600";
                      stripe = { borderLeft: `3px solid ${ev.color}` };
                    } else {
                      badge = "bg-stone-100 text-stone-400";
                      stripe = undefined;
                    }

                    const etiqueta = ev.tipo === "RESERVA"
                      ? "Reserva"
                      : ev.cancelada ? "Cancelada"
                      : ev.esInscrito ? "Inscrito"
                      : ev.tieneBono ? "Bono"
                      : "Clase";
                  return (
                    <div key={ev.id} className="w-full px-3 py-2 hover:bg-stone-50 transition-colors" style={stripe}>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onClickEvento?.(ev)}
                          className="min-w-0 text-left flex-1"
                        >
                          <p className="text-xs font-semibold text-stone-800 truncate">{ev.titulo}</p>
                          <p className="text-xs text-stone-500 truncate">{ev.horaInicio} - {ev.horaFin}</p>
                          <p className="text-xs text-stone-400 truncate">{ev.salaNombre}</p>
                          {ev.tipo === "CLASE" && ev.esInscrito && (
                            <p className="text-[10px] text-emerald-700 font-medium">Inscrito</p>
                          )}
                          {ev.tipo === "CLASE" && !ev.esInscrito && ev.tieneBono && (
                            <p className="text-[10px] text-violet-700 font-medium">Puedes apuntarte con bono</p>
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[10px] rounded ${badge}`}>
                            {etiqueta}
                          </span>
                          {onEliminarEvento && ev.tipo === "CLASE" && (
                            <button
                              type="button"
                              onClick={() => onEliminarEvento(ev)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
