"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CalendarioGrid from "@/components/CalendarioGrid";
import CalendarioLista from "@/components/CalendarioLista";
import type { EventoCalendario, SalaLite } from "@/components/calendario-types";
import { getLunesLocal, toLocalYMD } from "@/components/calendario-utils";

type SesionApi = {
  id?: string;
  claseId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cancelada: boolean;
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

export default function ProfesionalCalendarioPage() {
  const [lunes, setLunes] = useState<Date>(() => getLunesLocal(new Date()));
  const [loading, setLoading] = useState(true);
  const [salas, setSalas] = useState<SalaLite[]>([]);
  const [sesiones, setSesiones] = useState<SesionApi[]>([]);
  const [reservas, setReservas] = useState<ReservaApi[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ salaId: "", fecha: "", horaInicio: "09:00", horaFin: "10:00", motivo: "" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async (lunesDate: Date) => {
    setLoading(true);
    const res = await fetch(`/api/profesional/sesiones/semana?fecha=${toLocalYMD(lunesDate)}`);
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
    const clases = sesiones.map((s, i) => ({
      id: s.id || `${s.claseId}_${s.fecha}_${i}`,
      tipo: "CLASE" as const,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      salaId: s.clase.sala.id,
      salaNombre: s.clase.sala.nombre,
      titulo: s.clase.nombre,
      subtitulo: s.clase.profesor.nombre,
      cancelada: s.cancelada,
      raw: s,
    }));

    const res = reservas.map((r) => ({
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

    return [...clases, ...res];
  }, [sesiones, reservas]);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });
  const domingo = dias[6];
  const labelSemana = `${lunes.getDate()} ${lunes.toLocaleString("es-ES", { month: "short" })} - ${domingo.getDate()} ${domingo.toLocaleString("es-ES", { month: "short", year: "numeric" })}`;

  function onClickHueco(ctx: { fecha: string; salaId: string; hora: string }) {
    setForm({
      salaId: ctx.salaId,
      fecha: ctx.fecha,
      horaInicio: ctx.hora,
      horaFin: `${String(Math.min(Number(ctx.hora.slice(0, 2)) + 1, 22)).padStart(2, "0")}:00`,
      motivo: "",
    });
    setError("");
    setFormOpen(true);
  }

  async function guardarReserva(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");

    const res = await fetch("/api/profesional/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "No se pudo crear la solicitud");
    } else {
      setFormOpen(false);
      setMensaje("Solicitud enviada. Pendiente de validacion por el admin.");
      await cargar(lunes);
    }

    setGuardando(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Calendario</h1>
          <p className="text-stone-500 text-sm mt-1">Selecciona un hueco libre para solicitar una reserva</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLunes((p) => { const d = new Date(p); d.setDate(d.getDate() - 7); return d; })} className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50">‹</button>
          <span className="text-sm font-medium text-stone-700 min-w-[220px] text-center">{labelSemana}</span>
          <button onClick={() => setLunes((p) => { const d = new Date(p); d.setDate(d.getDate() + 7); return d; })} className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50">›</button>
          <button onClick={() => setLunes(getLunesLocal(new Date()))} className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg hover:bg-stone-50">Hoy</button>
        </div>
      </div>

      {mensaje && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{mensaje}</div>}

      {loading ? (
        <div className="text-center py-16 text-stone-400 text-sm">Cargando calendario...</div>
      ) : (
        <>
          <CalendarioGrid lunes={lunes} salas={salas} eventos={eventos} onClickHueco={onClickHueco} />
          <CalendarioLista lunes={lunes} eventos={eventos} />
        </>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Solicitar reserva</h2>
            {error && <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <form onSubmit={guardarReserva} className="space-y-3">
              <div>
                <label className="block text-sm text-stone-700 mb-1">Sala</label>
                <select value={form.salaId} onChange={(e) => setForm({ ...form, salaId: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm">
                  <option value="">Selecciona...</option>
                  {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-stone-700 mb-1">Fecha</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-stone-700 mb-1">Hora inicio</label>
                  <input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-stone-700 mb-1">Hora fin</label>
                  <input type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-stone-700 mb-1">Motivo (opcional)</label>
                <textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm" rows={3} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-2 border border-stone-300 rounded-lg text-sm hover:bg-stone-50">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700 disabled:opacity-50">
                  {guardando ? "Enviando..." : "Enviar solicitud"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
