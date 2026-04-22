import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const solicitud = await prisma.solicitudAlta.findUnique({ where: { id: params.id } });
  if (!solicitud) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json({ error: "La solicitud ya fue procesada" }, { status: 409 });
  }

  await prisma.solicitudAlta.update({
    where: { id: params.id },
    data: { estado: "DESCARTADA", leida: true },
  });

  return NextResponse.json({ ok: true });
}
