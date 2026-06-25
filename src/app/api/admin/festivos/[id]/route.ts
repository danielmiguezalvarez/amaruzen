import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generarSesionesPorRango, normalizarFecha } from "@/lib/sesiones";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const festivo = await prisma.festivo.findUnique({
    where: { id: params.id },
    select: { id: true, fecha: true },
  });
  if (!festivo) {
    return NextResponse.json({ error: "Festivo no encontrado" }, { status: 404 });
  }

  await prisma.festivo.delete({ where: { id: festivo.id } });

  const fecha = normalizarFecha(festivo.fecha);
  await generarSesionesPorRango(fecha, fecha);

  return NextResponse.json({ ok: true });
}
