import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { resolverHorarioFechaDesdeRef } from "@/lib/sesiones";

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { sesionRef } = await req.json();
  if (!sesionRef) {
    return NextResponse.json({ error: "Falta sesionRef" }, { status: 400 });
  }

  const resolved = await resolverHorarioFechaDesdeRef(sesionRef);
  if (!resolved) {
    return NextResponse.json({ error: "Sesion no encontrada" }, { status: 404 });
  }

  const sesion = await prisma.sesion.findUnique({
    where: {
      horarioId_fecha: {
        horarioId: resolved.horarioId,
        fecha: resolved.fecha,
      },
    },
    include: {
      _count: {
        select: {
          cambiosComoOrigen: true,
          cambiosComoDestino: true,
        },
      },
    },
  });

  if (!sesion) {
    return NextResponse.json({ error: "Sesion no encontrada" }, { status: 404 });
  }

  if (sesion._count.cambiosComoOrigen > 0 || sesion._count.cambiosComoDestino > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar: la sesión tiene cambios asociados" },
      { status: 409 }
    );
  }

  await prisma.sesion.delete({ where: { id: sesion.id } });

  return NextResponse.json({ ok: true });
}
