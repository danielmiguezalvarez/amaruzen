import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { calcularOcupacionesSemanaBatch, calcularSesionesSemana, getLunes, keySesion } from "@/lib/sesiones";

// GET /api/admin/sesiones/semana?fecha=YYYY-MM-DD
// Devuelve sesiones virtuales + materializadas de la semana
export async function GET(req: Request) {
  const t0 = Date.now();

  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const tAuth = Date.now();

  const { searchParams } = new URL(req.url);
  const fechaParam = searchParams.get("fecha");

  const base = fechaParam ? new Date(fechaParam) : new Date();
  if (Number.isNaN(base.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const lunes = getLunes(base);
  const { domingo, salas, sesiones, reservas } = await calcularSesionesSemana(lunes);
  const tSemana = Date.now();

  const ocupaciones = await calcularOcupacionesSemanaBatch(sesiones);
  const tOcupacion = Date.now();

  const sesionesConOcupacion = sesiones.map((s) => {
    const ocupacion = ocupaciones.get(keySesion(s.horarioId, s.fecha)) || {
      inscritos: 0,
      ausencias: 0,
      cambiosEntrantes: 0,
      cambiosSalientes: 0,
      ocupados: 0,
      libres: s.aforo,
    };
    return {
      id: s.sesionId || `${s.horarioId}__${s.fecha.toISOString().slice(0, 10)}`,
      sesionId: s.sesionId,
      horarioId: s.horarioId,
      claseId: s.claseId,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      aforo: s.aforo,
      cancelada: s.cancelada,
      ocupacion,
      clase: s.clase,
    };
  });
  const tMap = Date.now();

  const timings = {
    auth: tAuth - t0,
    semana: tSemana - tAuth,
    ocupacion: tOcupacion - tSemana,
    map: tMap - tOcupacion,
    total: tMap - t0,
  };

  console.log("[PERF] /api/admin/sesiones/semana", timings);

  return NextResponse.json({
    lunes: lunes.toISOString(),
    domingo: domingo.toISOString(),
    salas,
    sesiones: sesionesConOcupacion,
    reservas,
    _timings: timings,
  });
}
