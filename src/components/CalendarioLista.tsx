"use client";

import { buildWeekDays, toLocalYMD } from "@/components/calendario-utils";
import type { EventoCalendario } from "@/components/calendario-types";

type Props = {
  lunes: Date;
  eventos: EventoCalendario[];
  onClickEvento?: (evento: EventoCalendario) => void;
};

const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

export default function CalendarioLista({ lunes, eventos, onClickEvento }: Props) {
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
                  const badge = ev.tipo === "RESERVA"
                    ? "bg-blue-100 text-blue-700"
                    : ev.cancelada
                      ? "bg-red-100 text-red-700"
                      : ev.esInscrito
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-100 text-stone-600";
                  const stripe = ev.color && ev.tipo === "CLASE"
                    ? { borderLeft: `3px solid ${ev.color}` }
                    : undefined;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onClickEvento?.(ev)}
                      className="w-full text-left px-3 py-2 hover:bg-stone-50 transition-colors"
                      style={stripe}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-stone-800 truncate">{ev.titulo}</p>
                          <p className="text-xs text-stone-500 truncate">{ev.horaInicio} - {ev.horaFin}</p>
                          <p className="text-xs text-stone-400 truncate">{ev.salaNombre}</p>
                        </div>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${badge}`}>
                          {ev.tipo === "RESERVA" ? "Reserva" : "Clase"}
                        </span>
                      </div>
                    </button>
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
