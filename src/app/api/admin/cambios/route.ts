import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const cambios = await prisma.cambio.findMany({
    include: {
      user: true,
      sesionOrigen: { include: { clase: { include: { profesor: true } } } },
      sesionDestino: { include: { clase: { include: { profesor: true } } } },
      convenio: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(cambios);
}
