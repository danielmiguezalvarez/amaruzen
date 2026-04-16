import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSolicitudAltaAdmin } from "@/lib/email";

export async function POST(req: Request) {
  const { nombre, email, telefono, tipo, mensaje } = await req.json();

  if (!nombre || !email || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }
  if (tipo !== "ALUMNO" && tipo !== "PROFESIONAL") {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", activo: true },
    select: { email: true },
  });

  try {
    await Promise.all(
      admins.map((a) =>
        sendSolicitudAltaAdmin({
          to: a.email,
          nombre,
          email,
          telefono,
          tipo,
          mensaje,
        })
      )
    );
  } catch {
    // Ignorar errores de email externos
  }

  return NextResponse.json({ ok: true });
}
