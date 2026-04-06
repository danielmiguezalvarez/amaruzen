import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, descripcion, aforo, activa } = await req.json();
  const sala = await prisma.sala.update({
    where: { id: params.id },
    data: { nombre, descripcion, aforo: Number(aforo), activa },
  });
  return NextResponse.json(sala);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  await prisma.sala.update({ where: { id: params.id }, data: { activa: false } });
  return NextResponse.json({ ok: true });
}
