import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generarSesionesSemana, getLunes } from "@/lib/sesiones";

// GET /api/alumno/sesiones/semana?fecha=YYYY-MM-DD
// Genera (si falta) y devuelve las sesiones de esa semana filtradas a las clases del alumno
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fechaParam = searchParams.get("fecha");

  const base = fechaParam ? new Date(fechaParam) : new Date();
  const lunes = getLunes(base);
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  // Generar sesiones faltantes para esta semana
  await generarSesionesSemana(lunes);

  // Clases en las que el alumno está inscrito
  const inscripciones = await prisma.inscripcion.findMany({
    where: { userId: session.user.id, activa: true },
    select: { claseId: true },
  });
  const claseIds = inscripciones.map((i) => i.claseId);

  if (claseIds.length === 0) {
    return NextResponse.json({ lunes: lunes.toISOString(), domingo: domingo.toISOString(), sesiones: [] });
  }

  const sesiones = await prisma.sesion.findMany({
    where: {
      claseId: { in: claseIds },
      fecha: { gte: lunes, lte: domingo },
    },
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
