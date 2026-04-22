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

  // Persistir la solicitud en BD para que el admin la vea aunque el email falle
  await prisma.solicitudAlta.create({
    data: { nombre, email, telefono: telefono || null, tipo, mensaje: mensaje || null },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", activo: true },
    select: { email: true },
  });

  if (admins.length > 0) {
    const resultados = await Promise.allSettled(
      admins.map((a) =>
        sendSolicitudAltaAdmin({ to: a.email, nombre, email, telefono, tipo, mensaje })
      )
    );

    const alguno = resultados.some((r) => r.status === "fulfilled");
    if (!alguno) {
      // Todos fallaron — la solicitud está guardada pero avisar al frontend
      console.error(
        "[solicitud-alta] Todos los emails a admins fallaron:",
        resultados.map((r) => (r.status === "rejected" ? r.reason : "ok"))
      );
    }
  }

  return NextResponse.json({ ok: true });
}
