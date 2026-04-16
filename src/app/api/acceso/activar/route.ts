import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashInviteToken } from "@/lib/access-invites";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const tokenHash = hashInviteToken(String(token));
  const invitacion = await prisma.invitacionAcceso.findUnique({
    where: { tokenHash },
    include: { user: true, profesor: true },
  });

  if (!invitacion || invitacion.usedAt || invitacion.expiresAt < new Date()) {
    return NextResponse.json({ error: "La invitación no es válida o ha caducado" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(String(password), 12);

  const user = invitacion.user
    ? await prisma.user.update({
        where: { id: invitacion.user.id },
        data: { password: hashed, role: invitacion.role, activo: true },
      })
    : await prisma.user.update({
        where: { email: invitacion.email },
        data: { password: hashed, role: invitacion.role, activo: true },
      });

  if (invitacion.role === "PROFESIONAL" && invitacion.profesorId) {
    await prisma.profesor.update({
      where: { id: invitacion.profesorId },
      data: { userId: user.id },
    });
  }

  await prisma.invitacionAcceso.update({
    where: { id: invitacion.id },
    data: { usedAt: new Date(), userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
