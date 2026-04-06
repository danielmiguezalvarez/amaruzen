import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const convenios = await prisma.convenio.findMany({
    include: {
      claseA: { include: { profesor: true } },
      claseB: { include: { profesor: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(convenios);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseAId, claseBId, tipo, limiteMensual, requiereAprobacion } = await req.json();
  if (!claseAId || !claseBId || !tipo || !limiteMensual) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const convenio = await prisma.convenio.create({
    data: { claseAId, claseBId, tipo, limiteMensual: Number(limiteMensual), requiereAprobacion: Boolean(requiereAprobacion) },
    include: {
      claseA: { include: { profesor: true } },
      claseB: { include: { profesor: true } },
    },
  });
  return NextResponse.json(convenio, { status: 201 });
}
