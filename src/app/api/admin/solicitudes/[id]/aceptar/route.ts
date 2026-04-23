import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { crearInvitacionAcceso } from "@/lib/access-invites";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const solicitud = await prisma.solicitudAlta.findUnique({ where: { id: params.id } });
  if (!solicitud) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json({ error: "La solicitud ya fue procesada" }, { status: 409 });
  }
  if (solicitud.tipo !== "ALUMNO") {
    return NextResponse.json(
      { error: "Por ahora solo se pueden aceptar solicitudes de alumno desde aquí" },
      { status: 400 }
    );
  }

  const emailNorm = solicitud.email.trim().toLowerCase();

  // Si ya existe un usuario con ese email, no duplicar
  const existente = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
  });
  if (existente) {
    // Marcar aceptada apuntando al usuario ya existente y enviar invitación de todas formas
    await crearInvitacionAcceso({
      req,
      createdById: auth.session.user.id,
      userId: existente.id,
      email: existente.email,
      nombre: existente.name || solicitud.nombre,
      role: "ALUMNO",
    });

    await prisma.solicitudAlta.update({
      where: { id: params.id },
      data: { estado: "ACEPTADA", leida: true, usuarioId: existente.id },
    });

    return NextResponse.json({ ok: true, alumnoId: existente.id, yaExistia: true });
  }

  // Crear nuevo usuario alumno
  const alumno = await prisma.user.create({
      data: {
        name: solicitud.nombre,
        email: emailNorm,
        role: "ALUMNO",
        activo: true,
      },
  });

  // Enviar invitación de acceso
  await crearInvitacionAcceso({
    req,
    createdById: auth.session.user.id,
    userId: alumno.id,
    email: alumno.email,
    nombre: alumno.name || solicitud.nombre,
    role: "ALUMNO",
  });

  // Marcar solicitud como aceptada
  await prisma.solicitudAlta.update({
    where: { id: params.id },
    data: { estado: "ACEPTADA", leida: true, usuarioId: alumno.id },
  });

  return NextResponse.json({ ok: true, alumnoId: alumno.id, yaExistia: false });
}
