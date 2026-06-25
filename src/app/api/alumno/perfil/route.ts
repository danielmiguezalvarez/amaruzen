import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, notificaciones: true, resetPassword: true },
  });

  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { notificaciones, passwordActual, nuevaPassword } = await req.json();

  const data: { notificaciones?: boolean; password?: string; resetPassword?: boolean } = {};
  if (notificaciones !== undefined) data.notificaciones = Boolean(notificaciones);

  if (nuevaPassword !== undefined) {
    if (typeof nuevaPassword !== "string" || nuevaPassword.length < 8) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const userActual = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, resetPassword: true },
    });

    if (!userActual) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (!userActual.resetPassword) {
      if (typeof passwordActual !== "string" || !passwordActual) {
        return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
      }
      if (!userActual.password || !(await bcrypt.compare(passwordActual, userActual.password))) {
        return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
      }
    }

    data.password = await bcrypt.hash(nuevaPassword, 12);
    data.resetPassword = false;
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, notificaciones: true, resetPassword: true },
  });

  return NextResponse.json(user);
}
