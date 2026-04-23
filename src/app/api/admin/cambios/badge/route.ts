import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

// GET /api/admin/cambios/badge
// Devuelve el número de cambios en estado PENDIENTE (para badge en nav)
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const count = await prisma.cambio.count({
    where: { estado: "PENDIENTE" },
  });

  return NextResponse.json({ count });
}
