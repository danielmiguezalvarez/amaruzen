import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fin = new Date(hoy);
  fin.setDate(fin.getDate() + 28); // 4 semanas

  const sesiones = await prisma.sesion.findMany({
    where: { fecha: { gte: hoy, lte: fin } },
    include: {
      clase: { include: { profesor: true, sala: true } },
    },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });

  return NextResponse.json(sesiones);
}
