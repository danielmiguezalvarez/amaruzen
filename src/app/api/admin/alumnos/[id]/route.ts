import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, email, activo } = await req.json();

  // Si se da de baja, desactivar todas sus inscripciones
  if (activo === false) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inscripciones = await prisma.inscripcion.findMany({
      where: { userId: params.id },
      select: { id: true },
    });

    await prisma.inscripcion.updateMany({
      where: { userId: params.id },
      data: { activa: false },
    });

    await prisma.inscripcionHorario.updateMany({
      where: { inscripcionId: { in: inscripciones.map((i) => i.id) } },
      data: { activa: false },
    });

    await prisma.ausencia.deleteMany({
      where: {
        userId: params.id,
        fecha: { gte: hoy },
      },
    });

    await prisma.cambio.updateMany({
      where: {
        userId: params.id,
        estado: { in: ["PENDIENTE", "APROBADO"] },
        OR: [
          { sesionOrigen: { fecha: { gte: hoy } } },
          { sesionDestino: { fecha: { gte: hoy } } },
        ],
      },
      data: { estado: "RECHAZADO" },
    });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(nombre !== undefined ? { name: nombre } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(activo !== undefined ? { activo } : {}),
    },
  });
  return NextResponse.json(user);
}
