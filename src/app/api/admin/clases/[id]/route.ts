import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, profesorId, salaId, aforo, recurrente, diaSemana, horaInicio, horaFin, fechaFin, activa } = await req.json();

  const clase = await prisma.clase.update({
    where: { id: params.id },
    data: {
      nombre,
      profesorId,
      salaId,
      aforo: Number(aforo),
      recurrente: Boolean(recurrente),
      diaSemana: recurrente ? diaSemana : null,
      horaInicio,
      horaFin,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      activa,
    },
    include: { profesor: true, sala: true, tipoClase: true },
  });
  return NextResponse.json(clase);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  await prisma.clase.update({ where: { id: params.id }, data: { activa: false } });
  return NextResponse.json({ ok: true });
}
