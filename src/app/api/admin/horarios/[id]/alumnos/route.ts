import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const horario = await prisma.horario.findUnique({
    where: { id: params.id },
    include: {
      clase: { select: { nombre: true } },
      sala: { select: { nombre: true } },
    },
  });
  if (!horario) {
    return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
  }

  const inscripciones = await prisma.inscripcionHorario.findMany({
    where: {
      horarioId: params.id,
      activa: true,
      inscripcion: {
        activa: true,
        user: { activo: true },
      },
    },
    include: {
      inscripcion: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const alumnos = inscripciones
    .map((i) => i.inscripcion.user)
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "es"));

  return NextResponse.json({
    horario: {
      id: horario.id,
      clase: horario.clase.nombre,
      sala: horario.sala.nombre,
      diaSemana: horario.diaSemana,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
      aforo: horario.aforo,
    },
    alumnos,
  });
}
