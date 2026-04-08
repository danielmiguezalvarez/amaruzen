import { NextResponse } from "next/server";
import { requireProfesional } from "@/lib/api-auth";
import { calcularSesionesSemana, getLunes } from "@/lib/sesiones";

// GET /api/profesional/sesiones/semana?fecha=YYYY-MM-DD
// Calendario semanal para profesionales: clases y reservas aprobadas
export async function GET(req: Request) {
  try {
    const auth = await requireProfesional();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const fechaParam = searchParams.get("fecha");

    const base = fechaParam ? new Date(fechaParam) : new Date();
    if (Number.isNaN(base.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const lunes = getLunes(base);
    const { domingo, salas, sesiones, reservas } = await calcularSesionesSemana(lunes);

    return NextResponse.json({
      lunes: lunes.toISOString(),
      domingo: domingo.toISOString(),
      salas,
      sesiones,
      reservas,
    });
  } catch (err) {
    console.error("[ERROR] /api/profesional/sesiones/semana", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
