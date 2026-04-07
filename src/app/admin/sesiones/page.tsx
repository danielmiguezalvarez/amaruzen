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
  horarioId: string;
  claseId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  ocupacion: { ocupados: number };
  clase: {
    nombre: string;
    color?: string | null;
    profesor: { nombre: string };
    sala: { id: string; nombre: string; color?: string | null };
  };
};

type ReservaApi = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string | null;
  sala: { id: string; nombre: string; color?: string | null };
  profesional: { name: string | null };
};

type FichaData = {
  ocupacion: { ocupados: number };
  sesion: { id: string | null; aforo: number; horarioId: string; fecha: string; claseId: string };
  alumnos: Array<{ id: string; name: string | null; email: string }>;
};

type ClaseLite = {
  id: string;
  nombre: string;
  activa?: boolean;
  profesor: { id: string; nombre: string };
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
  const [fichaLoading, setFichaLoading] = useState(false);
  const [moverOpen, setMoverOpen] = useState(false);
  const [alumnoMoverId, setAlumnoMoverId] = useState("");
  const [moverDestinoId, setMoverDestinoId] = useState("");
  const [moverPermanente, setMoverPermanente] = useState(false);
  const [procesandoMover, setProcesandoMover] = useState(false);

  const [puntualOpen, setPuntualOpen] = useState(false);
  const [clasesLite, setClasesLite] = useState<ClaseLite[]>([]);
  const [puntualForm, setPuntualForm] = useState({
    claseId: "",
    profesorId: "",
    salaId: "",
    fecha: "",
    horaInicio: "09:00",
    horaFin: "10:00",
    aforo: "",
  });
  const [guardandoPuntual, setGuardandoPuntual] = useState(false);
  const [errorPuntual, setErrorPuntual] = useState("");

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

  useEffect(() => {
    fetch("/api/admin/clases")
      .then((r) => r.json())
      .then((data) => {
        setClasesLite((data || []).filter((c: ClaseLite) => c.activa));
      })
      .catch(() => {
        setClasesLite([]);
      });
  }, []);

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
      color: s.clase.color || null,
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
    setFichaLoading(true);

    const res = await fetch(`/api/admin/sesiones/ficha?sesionRef=${encodeURIComponent(sesion.id)}`);
    if (res.ok) {
      const data = await res.json();
      setFichaData(data);
    }
    setFichaLoading(false);
  }

  function abrirMoverAlumno(alumnoId: string) {
    if (!fichaData) return;
    setAlumnoMoverId(alumnoId);
    setMoverDestinoId("");
    setMoverPermanente(false);
    setMoverOpen(true);
  }

  async function marcarAusenciaAlumno(alumnoId: string) {
    if (!fichaData) return;
    const origenRef = `${fichaData.sesion.horarioId}__${new Date(fichaData.sesion.fecha).toISOString().slice(0, 10)}`;
    await fetch("/api/admin/sesiones/ficha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "AUSENCIA",
        userId: alumnoId,
        sesionOrigenId: origenRef,
      }),
    });

    const refetch = await fetch(`/api/admin/sesiones/ficha?sesionRef=${encodeURIComponent(origenRef)}`);
    if (refetch.ok) setFichaData(await refetch.json());
  }

  async function ejecutarMover() {
    if (!fichaData || !alumnoMoverId || !moverDestinoId) return;
    setProcesandoMover(true);
    const res = await fetch("/api/admin/sesiones/ficha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "CAMBIO",
        userId: alumnoMoverId,
        sesionOrigenId: `${fichaData.sesion.horarioId}__${new Date(fichaData.sesion.fecha).toISOString().slice(0, 10)}`,
        sesionDestinoId: moverDestinoId,
        permanente: moverPermanente,
      }),
    });
    setProcesandoMover(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "No se pudo completar el cambio");
      return;
    }
    setMoverOpen(false);
    await cargar(lunes);
    setFichaOpen(false);
    setFichaData(null);
  }

  const opcionesMover = sesiones
    .filter((s) => {
      if (!fichaData) return false;
      const origenKey = `${fichaData.sesion.horarioId}__${new Date(fichaData.sesion.fecha).toISOString().slice(0, 10)}`;
      return s.id !== origenKey && !s.cancelada;
    })
    .map((s) => ({
      id: s.id,
      label: `${s.clase.nombre} · ${new Date(s.fecha).toLocaleDateString("es-ES")} · ${s.horaInicio}-${s.horaFin} · ${s.clase.sala.nombre}`,
    }));

  function onClickHueco(ctx: { fecha: string; salaId: string; hora: string }) {
    const sala = salas.find((s) => s.id === ctx.salaId);
    setPuntualForm({
      claseId: "",
      profesorId: "",
      salaId: ctx.salaId,
      fecha: ctx.fecha,
      horaInicio: ctx.hora,
      horaFin: `${String(Math.min(Number(ctx.hora.slice(0, 2)) + 1, 22)).padStart(2, "0")}:00`,
      aforo: sala?.aforo ? String(sala.aforo) : "",
    });
    setErrorPuntual("");
    setPuntualOpen(true);
  }

  const clasePuntual = clasesLite.find((c) => c.id === puntualForm.claseId) || null;

  async function crearPuntual(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoPuntual(true);
    setErrorPuntual("");

    const profId = puntualForm.profesorId || clasePuntual?.profesor.id;
    const res = await fetch("/api/admin/horarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claseId: puntualForm.claseId,
        profesorId: profId,
        salaId: puntualForm.salaId,
        fecha: puntualForm.fecha,
        horaInicio: puntualForm.horaInicio,
        horaFin: puntualForm.horaFin,
        aforo: puntualForm.aforo,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setErrorPuntual(data.error || "No se pudo crear el horario puntual");
      setGuardandoPuntual(false);
      return;
    }

    setPuntualOpen(false);
    setGuardandoPuntual(false);
    await cargar(lunes);
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
            onClickHueco={onClickHueco}
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
        cargando={fichaLoading}
        onMoverAlumno={abrirMoverAlumno}
        onAusenciaAlumno={marcarAusenciaAlumno}
      />

      {moverOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-3">Mover alumno</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-stone-700 mb-1">Sesión destino</label>
                <select
                  value={moverDestinoId}
                  onChange={(e) => setMoverDestinoId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                >
                  <option value="">Selecciona...</option>
                  {opcionesMover.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={moverPermanente}
                  onChange={(e) => setMoverPermanente(e.target.checked)}
                />
                Cambio permanente (no puntual)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMoverOpen(false)}
                  className="flex-1 py-2 border border-stone-300 rounded-lg text-sm hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarMover}
                  disabled={!moverDestinoId || procesandoMover}
                  className="flex-1 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700 disabled:opacity-50"
                >
                  {procesandoMover ? "Procesando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {puntualOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Crear clase puntual</h2>
            {errorPuntual && <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{errorPuntual}</div>}
            <form onSubmit={crearPuntual} className="space-y-3">
              <div>
                <label className="block text-sm text-stone-700 mb-1">Clase</label>
                <select
                  required
                  value={puntualForm.claseId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const clase = clasesLite.find((c) => c.id === id);
                    setPuntualForm((prev) => ({ ...prev, claseId: id, profesorId: clase?.profesor.id || "" }));
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                >
                  <option value="">Selecciona...</option>
                  {clasesLite.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-stone-700 mb-1">Fecha</label>
                <input
                  required
                  type="date"
                  value={puntualForm.fecha}
                  onChange={(e) => setPuntualForm((prev) => ({ ...prev, fecha: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-stone-700 mb-1">Hora inicio</label>
                  <input
                    required
                    type="time"
                    value={puntualForm.horaInicio}
                    onChange={(e) => setPuntualForm((prev) => ({ ...prev, horaInicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-stone-700 mb-1">Hora fin</label>
                  <input
                    required
                    type="time"
                    value={puntualForm.horaFin}
                    onChange={(e) => setPuntualForm((prev) => ({ ...prev, horaFin: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-stone-700 mb-1">Aforo</label>
                <input
                  type="number"
                  min="1"
                  value={puntualForm.aforo}
                  onChange={(e) => setPuntualForm((prev) => ({ ...prev, aforo: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPuntualOpen(false)}
                  className="flex-1 py-2 border border-stone-300 rounded-lg text-sm hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPuntual}
                  className="flex-1 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700 disabled:opacity-50"
                >
                  {guardandoPuntual ? "Guardando..." : "Crear puntual"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
