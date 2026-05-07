import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import type { EstadoCambio } from "@prisma/client";

// GET /api/admin/cambios/badge?vistoAt=<timestamp_ms>
// Devuelve el número de cambios nuevos desde la última visita del admin.
// Si no se pasa vistoAt, cuenta todos los PENDIENTE.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const vistoAtParam = searchParams.get("vistoAt");
  const vistoAt = vistoAtParam ? new Date(Number(vistoAtParam)) : null;

  let count: number;
  if (vistoAt) {
    const estados: EstadoCambio[] = ["PENDIENTE", "APROBADO"];
    count = await prisma.cambio.count({
      where: { estado: { in: estados }, createdAt: { gt: vistoAt } },
    });
  } else {
    // Sin vistoAt: PENDIENTE + APROBADO en últimas 24h
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const estados: EstadoCambio[] = ["PENDIENTE", "APROBADO"];
    count = await prisma.cambio.count({
      where: { estado: { in: estados }, createdAt: { gte: hace24h } },
    });
  }

  return NextResponse.json({ count });
}
