import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { calcularOcupacionesSemanaBatch, calcularSesionesSemana, getLunes, keySesion } from "@/lib/sesiones";

// GET /api/admin/sesiones/semana?fecha=YYYY-MM-DD
// Devuelve sesiones materializadas + ocupación de la semana
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const fechaParam = searchParams.get("fecha");

    const base = fechaParam ? new Date(fechaParam) : new Date();
    if (Number.isNaN(base.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const lunes = getLunes(base);
    const { domingo, salas, sesiones, reservas } = await calcularSesionesSemana(lunes);
    const ocupaciones = await calcularOcupacionesSemanaBatch(sesiones);

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

    return NextResponse.json({
      lunes: lunes.toISOString(),
      domingo: domingo.toISOString(),
      salas,
      sesiones: sesionesConOcupacion,
      reservas,
    });
  } catch (err) {
    console.error("[ERROR] /api/admin/sesiones/semana", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
