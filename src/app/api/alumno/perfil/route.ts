import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, notificaciones: true },
  });

  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { notificaciones } = await req.json();

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { notificaciones: Boolean(notificaciones) },
    select: { id: true, notificaciones: true },
  });

  return NextResponse.json(user);
}
