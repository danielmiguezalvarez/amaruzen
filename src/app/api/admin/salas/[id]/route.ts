import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, descripcion, aforo, activa, color } = await req.json();
  const data: {
    nombre?: string;
    descripcion?: string | null;
    aforo?: number;
    activa?: boolean;
    color?: string | null;
  } = {};

  if (typeof nombre === "string") data.nombre = nombre;
  if (descripcion !== undefined) data.descripcion = descripcion || null;
  if (aforo !== undefined) data.aforo = Number(aforo);
  if (typeof activa === "boolean") data.activa = activa;
  if (color !== undefined) data.color = color || null;

  const sala = await prisma.sala.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(sala);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  await prisma.sala.update({ where: { id: params.id }, data: { activa: false } });
  return NextResponse.json({ ok: true });
}
