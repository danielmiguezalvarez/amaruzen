import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseAId, claseBId, tipo, limiteMensual, requiereAprobacion, activo } = await req.json();

  const data: {
    claseAId?: string;
    claseBId?: string;
    tipo?: "EQUIVALENTE" | "EXCEPCIONAL";
    limiteMensual?: number;
    requiereAprobacion?: boolean;
    activo?: boolean;
  } = {};

  if (typeof claseAId === "string") data.claseAId = claseAId;
  if (typeof claseBId === "string") data.claseBId = claseBId;
  if (tipo === "EQUIVALENTE" || tipo === "EXCEPCIONAL") data.tipo = tipo;
  if (limiteMensual !== undefined) data.limiteMensual = Number(limiteMensual);
  if (requiereAprobacion !== undefined) data.requiereAprobacion = Boolean(requiereAprobacion);
  if (activo !== undefined) data.activo = Boolean(activo);

  const convenio = await prisma.convenio.update({
    where: { id: params.id },
    data,
    include: {
      claseA: { include: { profesor: true } },
      claseB: { include: { profesor: true } },
    },
  });

  return NextResponse.json(convenio);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  await prisma.convenio.update({ where: { id: params.id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
