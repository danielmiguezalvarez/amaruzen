"use client";

import { useEffect, useState, useCallback } from "react";

type Sesion = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  clase: {
    nombre: string;
    profesor: { nombre: string };
    sala: { nombre: string };
  };
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

export default function SesionesPage() {
  const [lunes, setLunes] = useState<Date>(() => getLunesLocal(new Date()));
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async (lunesDate: Date) => {
    setLoading(true);
    const res = await fetch(`/api/admin/sesiones/semana?fecha=${toLocalYMD(lunesDate)}`);
    if (res.ok) {
      const data = await res.json();
      setSesiones(data.sesiones);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(lunes); }, [lunes, cargar]);

  function semanaAnterior() {
    setLunes((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function semanasiguiente() {
    setLunes((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  function hoyEnRango() {
    const hoyLunes = getLunesLocal(new Date());
    return hoyLunes.getTime() === lunes.getTime();
  }

  // Construir array de 7 fechas (lunes → domingo)
  const diasSemana: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Indexar sesiones por fecha (YYYY-MM-DD local)
  const porDia: Record<string, Sesion[]> = {};
  diasSemana.forEach((d) => { porDia[toLocalYMD(d)] = []; });
  sesiones.forEach((s) => {
    // Use local date to handle potential UTC shift from Supabase
    const localKey = toLocalYMD(new Date(s.fecha));
    if (porDia[localKey] !== undefined) {
      porDia[localKey].push(s);
    }
  });

  const domingo = diasSemana[6];
  const labelSemana = `${lunes.getDate()} ${lunes.toLocaleString("es-ES", { month: "short" })} – ${domingo.getDate()} ${domingo.toLocaleString("es-ES", { month: "short", year: "numeric" })}`;

  const hoy = toLocalYMD(new Date());

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Sesiones</h1>
          <p className="text-stone-500 text-sm mt-1">Vista semanal · Las sesiones se generan automáticamente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={semanaAnterior}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600">
            ‹
          </button>
          <span className="text-sm font-medium text-stone-700 min-w-[180px] text-center">{labelSemana}</span>
          <button onClick={semanasiguiente}
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
                {/* Cabecera día */}
                <div className={`px-3 py-2 text-center ${esHoy ? "bg-stone-800 text-white" : "bg-stone-50 text-stone-600"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide">{DIAS[i]}</p>
                  <p className={`text-lg font-bold leading-tight ${esHoy ? "text-white" : "text-stone-800"}`}>
                    {dia.getDate()}
                  </p>
                </div>

                {/* Sesiones del día */}
                <div className="bg-white divide-y divide-stone-100 min-h-[80px]">
                  {sesionesDia.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-stone-300 text-center">Sin sesiones</p>
                  ) : (
                    sesionesDia.map((s) => (
                      <div key={s.id} className={`px-3 py-2 ${s.cancelada ? "opacity-40" : ""}`}>
                        <p className="text-xs font-semibold text-stone-800 leading-tight">{s.clase.nombre}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{s.horaInicio} - {s.horaFin}</p>
                        <p className="text-xs text-stone-400">{s.clase.profesor.nombre}</p>
                        <p className="text-xs text-stone-400">{s.clase.sala.nombre}</p>
                        {s.cancelada && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">Cancelada</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
