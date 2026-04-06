import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

// Añadir inscripción
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId } = await req.json();

  // Comprobar que hay hueco
  const clase = await prisma.clase.findUnique({ where: { id: claseId } });
  if (!clase) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });

  const inscritos = await prisma.inscripcion.count({ where: { claseId, activa: true } });
  if (inscritos >= clase.aforo) {
    return NextResponse.json({ error: "La clase está completa" }, { status: 409 });
  }

  const inscripcion = await prisma.inscripcion.upsert({
    where: { userId_claseId: { userId: params.id, claseId } },
    update: { activa: true },
    create: { userId: params.id, claseId },
  });
  return NextResponse.json(inscripcion, { status: 201 });
}

// Eliminar inscripción
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId } = await req.json();

  await prisma.inscripcion.updateMany({
    where: { userId: params.id, claseId },
    data: { activa: false },
  });
  return NextResponse.json({ ok: true });
}
