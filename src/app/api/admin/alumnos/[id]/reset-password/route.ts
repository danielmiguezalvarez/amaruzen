import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

function generateTemporaryPassword() {
  return `amaruzen-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "No está configurado el envío de email" }, { status: 500 });
    }

    const alumno = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!alumno || alumno.role !== "ALUMNO") {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    await sendPasswordResetEmail({
      to: alumno.email,
      nombre: alumno.name || "alumno",
      nuevaPassword: temporaryPassword,
    });

    await prisma.user.update({
      where: { id: alumno.id },
      data: {
        password: hashedPassword,
        resetPassword: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo restablecer la contraseña" }, { status: 500 });
  }
}
