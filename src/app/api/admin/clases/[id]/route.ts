import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, profesorId, salaId, aforo, recurrente, diaSemana, horaInicio, horaFin, fechaFin, activa, color } = await req.json();

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
      color: color || null,
      activa,
    },
    include: { profesor: true, sala: true, tipoClase: true },
  });

  // Actualizar sesiones futuras (aún no iniciadas) con el nuevo horario y aforo
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);

  await prisma.sesion.updateMany({
    where: {
      claseId: params.id,
      fecha: { gte: ahora },
    },
    data: {
      horaInicio,
      horaFin,
      aforo: Number(aforo),
    },
  });

  // Si se añadió fechaFin, cancelar (o borrar) sesiones que queden fuera del rango
  if (fechaFin) {
    const limite = new Date(fechaFin);
    limite.setHours(23, 59, 59, 999);
    await prisma.sesion.deleteMany({
      where: {
        claseId: params.id,
        fecha: { gt: limite },
        // Solo borrar sesiones sin inscripciones activas vinculadas
        cambiosComoOrigen: { none: {} },
        cambiosComoDestino: { none: {} },
      },
    });
  }

  return NextResponse.json(clase);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  await prisma.clase.update({ where: { id: params.id }, data: { activa: false } });
  return NextResponse.json({ ok: true });
}
