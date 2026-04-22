import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const solicitudes = await prisma.solicitudAlta.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(solicitudes);
}

// Marcar como leída
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const sol = await prisma.solicitudAlta.update({
    where: { id },
    data: { leida: true },
  });

  return NextResponse.json(sol);
}
