"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CalendarioGrid from "@/components/CalendarioGrid";
import CalendarioLista from "@/components/CalendarioLista";
import FichaSesionModal from "@/components/FichaSesionModal";
import type { EventoCalendario, SalaLite } from "@/components/calendario-types";
import { getLunesLocal, toLocalYMD } from "@/components/calendario-utils";

type SesionApi = {
  id: string;
  sesionId: string | null;
  claseId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  ocupacion: { ocupados: number };
  clase: {
    nombre: string;
    profesor: { nombre: string };
    sala: { id: string; nombre: string };
  };
};

type ReservaApi = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string | null;
  sala: { id: string; nombre: string };
  profesional: { name: string | null };
};

type FichaData = {
  ocupacion: { ocupados: number };
  sesion: { aforo: number };
  alumnos: Array<{ id: string; name: string | null; email: string }>;
};

export default function SesionesPage() {
  const [lunes, setLunes] = useState<Date>(() => getLunesLocal(new Date()));
  const [loading, setLoading] = useState(true);
  const [salas, setSalas] = useState<SalaLite[]>([]);
  const [sesiones, setSesiones] = useState<SesionApi[]>([]);
  const [reservas, setReservas] = useState<ReservaApi[]>([]);

  const [fichaOpen, setFichaOpen] = useState(false);
  const [fichaTitulo, setFichaTitulo] = useState("");
  const [fichaSubtitulo, setFichaSubtitulo] = useState("");
  const [fichaData, setFichaData] = useState<FichaData | null>(null);

  const cargar = useCallback(async (lunesDate: Date) => {
    setLoading(true);
    const res = await fetch(`/api/admin/sesiones/semana?fecha=${toLocalYMD(lunesDate)}`);
    if (res.ok) {
      const data = await res.json();
      setSalas(data.salas || []);
      setSesiones(data.sesiones || []);
      setReservas(data.reservas || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar(lunes);
  }, [lunes, cargar]);

  const eventos: EventoCalendario[] = useMemo(() => {
    const eventosSesiones = sesiones.map((s) => ({
      id: s.id,
      tipo: "CLASE" as const,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      salaId: s.clase.sala.id,
      salaNombre: s.clase.sala.nombre,
      titulo: s.clase.nombre,
      subtitulo: `${s.clase.profesor.nombre} · ${s.ocupacion.ocupados}/${s.aforo}`,
      cancelada: s.cancelada,
      raw: s,
    }));

    const eventosReservas = reservas.map((r) => ({
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
    }));

    return [...eventosSesiones, ...eventosReservas];
  }, [sesiones, reservas]);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });
  const domingo = dias[6];
  const labelSemana = `${lunes.getDate()} ${lunes.toLocaleString("es-ES", { month: "short" })} - ${domingo.getDate()} ${domingo.toLocaleString("es-ES", { month: "short", year: "numeric" })}`;

  async function abrirFicha(ev: EventoCalendario) {
    if (ev.tipo !== "CLASE") return;
    const sesion = ev.raw as SesionApi;
    setFichaTitulo(sesion.clase.nombre);
    setFichaSubtitulo(`${new Date(sesion.fecha).toLocaleDateString("es-ES")} · ${sesion.horaInicio}-${sesion.horaFin} · ${sesion.clase.sala.nombre}`);
    setFichaOpen(true);

    const res = await fetch(`/api/admin/sesiones/ficha?sesionRef=${encodeURIComponent(sesion.id)}`);
    if (res.ok) {
      const data = await res.json();
      setFichaData(data);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Sesiones</h1>
          <p className="text-stone-500 text-sm mt-1">Calendario semanal por salas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLunes((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-stone-700 min-w-[220px] text-center">{labelSemana}</span>
          <button
            onClick={() => setLunes((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50"
          >
            ›
          </button>
          <button
            onClick={() => setLunes(getLunesLocal(new Date()))}
            className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg hover:bg-stone-50"
          >
            Hoy
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400 text-sm">Cargando calendario...</div>
      ) : (
        <>
          <CalendarioGrid
            lunes={lunes}
            salas={salas}
            eventos={eventos}
            onClickEvento={abrirFicha}
          />
          <CalendarioLista lunes={lunes} eventos={eventos} onClickEvento={abrirFicha} />
        </>
      )}

      <FichaSesionModal
        abierto={fichaOpen}
        onClose={() => { setFichaOpen(false); setFichaData(null); }}
        titulo={fichaTitulo}
        subtitulo={fichaSubtitulo}
        ocupados={fichaData?.ocupacion.ocupados}
        aforo={fichaData?.sesion.aforo}
        alumnos={fichaData?.alumnos || []}
      />
    </div>
  );
}
