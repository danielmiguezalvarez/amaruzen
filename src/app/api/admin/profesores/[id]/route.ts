import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, email, telefono, activo } = await req.json();
  const profesor = await prisma.profesor.update({
    where: { id: params.id },
    data: { nombre, email, telefono, activo },
  });
  return NextResponse.json(profesor);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  await prisma.profesor.update({ where: { id: params.id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
