import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

// GET /api/admin/reservas?estado=PENDIENTE|APROBADA|RECHAZADA
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");

  const where = estado
    ? { estado: estado as "PENDIENTE" | "APROBADA" | "RECHAZADA" }
    : {};

  const reservas = await prisma.reserva.findMany({
    where,
    include: {
      sala: true,
      profesional: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(reservas);
}
