import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const salas = await prisma.sala.findMany({ orderBy: { nombre: "asc" } });
  return NextResponse.json(salas);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, descripcion, aforo, color } = await req.json();
  if (!nombre || !aforo) {
    return NextResponse.json({ error: "Nombre y aforo son obligatorios" }, { status: 400 });
  }

  const sala = await prisma.sala.create({ data: { nombre, descripcion, aforo: Number(aforo), color: color || null } });
  return NextResponse.json(sala, { status: 201 });
}
