import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { generarSesionesSemana, getLunes } from "@/lib/sesiones";

// GET /api/admin/sesiones/semana?fecha=YYYY-MM-DD
// Genera (si falta) y devuelve todas las sesiones de esa semana (lunes-domingo)
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const fechaParam = searchParams.get("fecha");

  const base = fechaParam ? new Date(fechaParam) : new Date();
  const lunes = getLunes(base);
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  // Generar sesiones que falten para esta semana
  await generarSesionesSemana(lunes);

  const sesiones = await prisma.sesion.findMany({
    where: { fecha: { gte: lunes, lte: domingo } },
    include: {
      clase: { include: { profesor: true, sala: true } },
    },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });

  return NextResponse.json({
    lunes: lunes.toISOString(),
    domingo: domingo.toISOString(),
    sesiones,
  });
}
