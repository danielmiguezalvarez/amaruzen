import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { resolverSesionId } from "@/lib/sesiones";

// POST /api/admin/cambios/crear
// body: { userId, sesionOrigenId, sesionDestinoId, convenioId?, forzado?, permanente? }
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { userId, sesionOrigenId, sesionDestinoId, convenioId, permanente } = await req.json();

  if (!userId || !sesionOrigenId || !sesionDestinoId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const sesionOrigenRealId = await resolverSesionId(sesionOrigenId);
  const sesionDestinoRealId = await resolverSesionId(sesionDestinoId);
  if (!sesionOrigenRealId || !sesionDestinoRealId) {
    return NextResponse.json({ error: "Sesion origen/destino no encontrada" }, { status: 404 });
  }

  const sesionOrigen = await prisma.sesion.findUnique({ where: { id: sesionOrigenRealId } });
  const sesionDestino = await prisma.sesion.findUnique({ where: { id: sesionDestinoRealId } });
  if (!sesionOrigen || !sesionDestino) {
    return NextResponse.json({ error: "Sesion origen/destino no encontrada" }, { status: 404 });
  }

  if (permanente) {
    const inscripcionOrigen = await prisma.inscripcion.findFirst({
      where: { userId, claseId: sesionOrigen.claseId, activa: true },
    });

    if (!inscripcionOrigen) {
      return NextResponse.json({ error: "Inscripción origen no encontrada" }, { status: 404 });
    }

    await prisma.inscripcionHorario.updateMany({
      where: {
        inscripcionId: inscripcionOrigen.id,
        horarioId: sesionOrigen.horarioId,
      },
      data: { activa: false },
    });

    const inscripcionDestino = await prisma.inscripcion.upsert({
      where: { userId_claseId: { userId, claseId: sesionDestino.claseId } },
      update: { activa: true },
      create: { userId, claseId: sesionDestino.claseId, activa: true },
    });

    await prisma.inscripcionHorario.upsert({
      where: {
        inscripcionId_horarioId: {
          inscripcionId: inscripcionDestino.id,
          horarioId: sesionDestino.horarioId,
        },
      },
      update: { activa: true },
      create: {
        inscripcionId: inscripcionDestino.id,
        horarioId: sesionDestino.horarioId,
        activa: true,
      },
    });

    return NextResponse.json({ ok: true, tipo: "PERMANENTE", inscripcion: inscripcionDestino }, { status: 201 });
  }

  const cambio = await prisma.cambio.create({
    data: {
      userId,
      sesionOrigenId: sesionOrigenRealId,
      sesionDestinoId: sesionDestinoRealId,
      convenioId: convenioId || null,
      estado: "APROBADO",
    },
    include: {
      user: true,
      sesionOrigen: { include: { clase: true } },
      sesionDestino: { include: { clase: true } },
    },
  });

  return NextResponse.json(cambio, { status: 201 });
}
