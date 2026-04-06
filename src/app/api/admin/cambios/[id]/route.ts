import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendCambioAprobado, sendCambioCancelado } from "@/lib/email";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { estado } = await req.json();

  const cambio = await prisma.cambio.update({
    where: { id: params.id },
    data: { estado },
    include: {
      user: true,
      sesionOrigen: { include: { clase: true } },
      sesionDestino: { include: { clase: true } },
    },
  });

  // Enviar email de notificación
  if (cambio.user.email) {
    if (estado === "APROBADO") {
      await sendCambioAprobado({
        to: cambio.user.email,
        nombre: cambio.user.name || "Alumno",
        claseOrigen: cambio.sesionOrigen.clase.nombre,
        claseDestino: cambio.sesionDestino.clase.nombre,
        fechaDestino: cambio.sesionDestino.fecha,
      });
    } else if (estado === "RECHAZADO") {
      await sendCambioCancelado({
        to: cambio.user.email,
        nombre: cambio.user.name || "Alumno",
        claseOrigen: cambio.sesionOrigen.clase.nombre,
        claseDestino: cambio.sesionDestino.clase.nombre,
      });
    }
  }

  return NextResponse.json(cambio);
}
