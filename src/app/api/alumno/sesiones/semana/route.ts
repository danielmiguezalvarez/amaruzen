import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calcularSesionesSemana, getLunes } from "@/lib/sesiones";

// GET /api/alumno/sesiones/semana?fecha=YYYY-MM-DD
// Devuelve sesiones del centro, marcando cuáles son del alumno
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fechaParam = searchParams.get("fecha");

  const base = fechaParam ? new Date(fechaParam) : new Date();
  if (Number.isNaN(base.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const lunes = getLunes(base);
  const { domingo, salas, sesiones, reservas } = await calcularSesionesSemana(lunes);

  // Clases en las que el alumno está inscrito
  const inscripciones = await prisma.inscripcion.findMany({
    where: { userId: session.user.id, activa: true },
    select: { claseId: true },
  });
  const clasesPropias = new Set(inscripciones.map((i) => i.claseId));

  const sesionesConFlag = sesiones.map((s) => ({
    id: s.sesionId || `${s.claseId}__${s.fecha.toISOString().slice(0, 10)}`,
    sesionId: s.sesionId,
    claseId: s.claseId,
    fecha: s.fecha,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    aforo: s.aforo,
    cancelada: s.cancelada,
    esInscrito: clasesPropias.has(s.claseId),
    clase: s.clase,
  }));

  return NextResponse.json({
    lunes: lunes.toISOString(),
    domingo: domingo.toISOString(),
    salas,
    sesiones: sesionesConFlag,
    reservas,
  });
}
