import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { materializarSesion, normalizarFecha } from "@/lib/sesiones";

function parseSesionRef(ref: string): { claseId: string; fecha: Date } | null {
  if (!ref.includes("__")) return null;
  const [claseId, fechaIso] = ref.split("__");
  if (!claseId || !fechaIso) return null;
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return null;
  return { claseId, fecha: normalizarFecha(fecha) };
}

async function resolverSesionId(ref: string) {
  const parsed = parseSesionRef(ref);
  if (!parsed) return ref;
  const { sesion } = await materializarSesion(parsed.claseId, parsed.fecha);
  return sesion.id;
}

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

  const sesionOrigen = await prisma.sesion.findUnique({ where: { id: sesionOrigenRealId } });
  const sesionDestino = await prisma.sesion.findUnique({ where: { id: sesionDestinoRealId } });
  if (!sesionOrigen || !sesionDestino) {
    return NextResponse.json({ error: "Sesion origen/destino no encontrada" }, { status: 404 });
  }

  if (permanente) {
    await prisma.inscripcion.updateMany({
      where: { userId, claseId: sesionOrigen.claseId, activa: true },
      data: { activa: false },
    });

    const inscripcion = await prisma.inscripcion.upsert({
      where: { userId_claseId: { userId, claseId: sesionDestino.claseId } },
      update: { activa: true },
      create: { userId, claseId: sesionDestino.claseId, activa: true },
    });

    return NextResponse.json({ ok: true, tipo: "PERMANENTE", inscripcion }, { status: 201 });
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
