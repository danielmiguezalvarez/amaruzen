import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const profesores = await prisma.profesor.findMany({ orderBy: { nombre: "asc" } });
  return NextResponse.json(profesores);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, email, telefono } = await req.json();
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const profesor = await prisma.profesor.create({ data: { nombre, email, telefono } });
  return NextResponse.json(profesor, { status: 201 });
}
