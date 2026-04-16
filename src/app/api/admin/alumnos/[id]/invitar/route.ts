import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { crearInvitacionAcceso } from "@/lib/access-invites";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const alumno = await prisma.user.findUnique({ where: { id: params.id } });
    if (!alumno || alumno.role !== "ALUMNO") {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    await crearInvitacionAcceso({
      req,
      createdById: auth.session.user.id,
      userId: alumno.id,
      email: alumno.email,
      nombre: alumno.name || "alumno",
      role: "ALUMNO",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo enviar la invitación" },
      { status: 500 }
    );
  }
}
