import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

// GET /api/admin/cambios/badge?vistoAt=<timestamp_ms>
// Devuelve el número de cambios nuevos desde la última visita del admin:
// - PENDIENTE creados después de vistoAt
// - APROBADO creados después de vistoAt (aprobados automáticamente)
// Si no se pasa vistoAt, cuenta todos los PENDIENTE.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const vistoAtParam = searchParams.get("vistoAt");
  const vistoAt = vistoAtParam ? new Date(Number(vistoAtParam)) : null;

  const where = vistoAt
    ? { createdAt: { gt: vistoAt }, estado: { in: ["PENDIENTE", "APROBADO"] as const } }
    : { estado: "PENDIENTE" as const };

  const count = await prisma.cambio.count({ where });

  return NextResponse.json({ count });
}
