"use client";

import { memo, useMemo } from "react";
import { DIAS_CORTOS, HORAS_DESKTOP, buildWeekDays, horaToDecimal, toLocalYMD } from "@/components/calendario-utils";
import type { EventoCalendario, SalaLite } from "@/components/calendario-types";

type Props = {
  lunes: Date;
  salas: SalaLite[];
  eventos: EventoCalendario[];
  onClickEvento?: (evento: EventoCalendario) => void;
  onClickHueco?: (ctx: { fecha: string; salaId: string; hora: string }) => void;
};

const START_HOUR = 8;
const END_HOUR = 22;
const PX_PER_HOUR = 48;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * PX_PER_HOUR;

function snapToHour(clientY: number, rect: DOMRect): string {
  const relY = Math.max(0, clientY - rect.top);
  const hour = Math.floor(relY / PX_PER_HOUR) + START_HOUR;
  const clamped = Math.min(Math.max(hour, START_HOUR), END_HOUR - 1);
  return `${String(clamped).padStart(2, "0")}:00`;
}

function CalendarioGrid({ lunes, salas, eventos, onClickEvento, onClickHueco }: Props) {
  const dias = useMemo(() => buildWeekDays(lunes), [lunes]);

  const eventosByDiaSala = useMemo(() => {
    const map: Record<string, EventoCalendario[]> = {};
    for (const ev of eventos) {
      const fecha = toLocalYMD(new Date(ev.fecha));
      const key = `${fecha}__${ev.salaId}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    Object.values(map).forEach((list) => {
      list.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    });
    return map;
  }, [eventos]);

  return (
    <div className="hidden lg:block bg-white border border-stone-200 rounded-xl overflow-auto">
      <div className="min-w-[1200px]">
        {/* Day headers */}
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(7, minmax(0, 1fr))` }}>
          <div className="border-b border-r border-stone-200 bg-stone-50" />
          {dias.map((d, i) => (
            <div key={toLocalYMD(d)} className="border-b border-stone-200 bg-stone-50 px-2 py-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{DIAS_CORTOS[i]}</p>
              <p className="text-sm font-semibold text-stone-800">{d.getDate()}</p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(7, minmax(0, 1fr))` }}>
          {/* Hour labels */}
          <div className="border-r border-stone-200">
            {HORAS_DESKTOP.map((h) => (
              <div key={h} className="h-12 border-b border-stone-100 px-1 text-[10px] text-stone-400 text-right pt-0.5">
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dias.map((dia) => {
            const fecha = toLocalYMD(dia);
            return (
              <div key={fecha} className="border-r border-stone-100 last:border-r-0">
                <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(salas.length, 1)}, minmax(0, 1fr))` }}>
                  {salas.map((sala) => {
                    const key = `${fecha}__${sala.id}`;
                    const eventosSala = eventosByDiaSala[key] || [];

                    return (
                      <div key={sala.id} className="relative border-r border-stone-100 last:border-r-0">
                        {/* Sala header */}
                        <div
                          className="sticky top-0 z-[1] bg-stone-50/90 backdrop-blur border-b border-stone-100 px-1 py-1 text-[10px] text-stone-500 text-center truncate"
                          style={sala.color ? { backgroundColor: `${sala.color}2b`, borderBottomColor: `${sala.color}55` } : undefined}
                        >
                          {sala.nombre}
                        </div>

                        {/* Grid body — single click-to-snap area replaces per-hour buttons */}
                        <div
                          className="relative"
                          style={{ height: `${GRID_HEIGHT}px` }}
                          onClick={onClickHueco ? (e) => {
                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const hora = snapToHour(e.clientY, rect);
                            onClickHueco({ fecha, salaId: sala.id, hora });
                          } : undefined}
                        >
                          {/* Hour guide lines */}
                          {HORAS_DESKTOP.map((h) => (
                            <div
                              key={h}
                              className="absolute left-0 right-0 border-b border-stone-100 pointer-events-none"
                              style={{ top: `${(h - START_HOUR) * PX_PER_HOUR}px`, height: `${PX_PER_HOUR}px` }}
                            />
                          ))}

                          {/* Events */}
                          {eventosSala.map((ev) => {
                            const top = (horaToDecimal(ev.horaInicio) - START_HOUR) * PX_PER_HOUR;
                            const height = Math.max((horaToDecimal(ev.horaFin) - horaToDecimal(ev.horaInicio)) * PX_PER_HOUR, 20);
                            const baseClass = ev.tipo === "RESERVA"
                              ? "bg-blue-100 border-blue-300 text-blue-900"
                              : ev.cancelada
                                ? "bg-red-100 border-red-300 text-red-900"
                                : ev.esInscrito
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                                  : "bg-stone-100 border-stone-300 text-stone-900";

                            const style: React.CSSProperties = {
                              top: `${top}px`,
                              height: `${height}px`,
                              ...(ev.color && ev.tipo === "CLASE"
                                ? {
                                    backgroundColor: `${ev.color}22`,
                                    borderColor: `${ev.color}99`,
                                    color: "#1f2937",
                                  }
                                : {}),
                            };

                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClickEvento?.(ev);
                                }}
                                className={`absolute left-1 right-1 rounded border px-1 py-0.5 text-left shadow-sm overflow-hidden z-[2] ${baseClass}`}
                                style={style}
                                title={`${ev.titulo} ${ev.horaInicio}-${ev.horaFin}`}
                              >
                                <p className="text-[10px] font-semibold leading-tight truncate">{ev.titulo}</p>
                                <p className="text-[10px] leading-tight opacity-80 truncate">{ev.horaInicio}-{ev.horaFin}</p>
                                {ev.subtitulo && <p className="text-[10px] leading-tight opacity-75 truncate">{ev.subtitulo}</p>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(CalendarioGrid);
