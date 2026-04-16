import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { crearInvitacionAcceso } from "@/lib/access-invites";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const profesor = await prisma.profesor.findUnique({ where: { id: params.id } });
    if (!profesor) {
      return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
    }
    if (!profesor.email) {
      return NextResponse.json({ error: "El profesor no tiene email" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email: profesor.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: profesor.nombre,
          email: profesor.email,
          role: "PROFESIONAL",
          password: null,
          activo: true,
        },
      });
    }

    if (user.role !== "PROFESIONAL") {
      return NextResponse.json(
        { error: "Ese email ya existe con otro rol de usuario" },
        { status: 409 }
      );
    }

    await prisma.profesor.update({ where: { id: profesor.id }, data: { userId: user.id } });

    await crearInvitacionAcceso({
      req,
      createdById: auth.session.user.id,
      userId: user.id,
      profesorId: profesor.id,
      email: profesor.email,
      nombre: profesor.nombre,
      role: "PROFESIONAL",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo enviar la invitación" },
      { status: 500 }
    );
  }
}
