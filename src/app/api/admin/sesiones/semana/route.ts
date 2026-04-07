import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { calcularOcupacionSesion, calcularSesionesSemana, getLunes } from "@/lib/sesiones";

// GET /api/admin/sesiones/semana?fecha=YYYY-MM-DD
// Devuelve sesiones virtuales + materializadas de la semana
export async function GET(req: Request) {
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

  const sesionesConOcupacion = await Promise.all(
    sesiones.map(async (s) => {
      const ocupacion = await calcularOcupacionSesion(s.claseId, s.fecha, s.aforo);
      return {
        id: s.sesionId || `${s.claseId}__${s.fecha.toISOString().slice(0, 10)}`,
        sesionId: s.sesionId,
        claseId: s.claseId,
        fecha: s.fecha,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        aforo: s.aforo,
        cancelada: s.cancelada,
        ocupacion,
        clase: s.clase,
      };
    })
  );

  return NextResponse.json({
    lunes: lunes.toISOString(),
    domingo: domingo.toISOString(),
    salas,
    sesiones: sesionesConOcupacion,
    reservas,
  });
}
