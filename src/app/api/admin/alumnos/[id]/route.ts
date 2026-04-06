import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, email, activo } = await req.json();

  // Si se da de baja, desactivar todas sus inscripciones
  if (activo === false) {
    await prisma.inscripcion.updateMany({
      where: { userId: params.id },
      data: { activa: false },
    });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { name: nombre, email, activo },
  });
  return NextResponse.json(user);
}
