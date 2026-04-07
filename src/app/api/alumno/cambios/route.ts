import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cambios = await prisma.cambio.findMany({
    where: { userId: session.user.id },
    include: {
      sesionOrigen: { include: { clase: { include: { profesor: true } } } },
      sesionDestino: { include: { clase: { include: { profesor: true } } } },
      convenio: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(cambios);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { sesionOrigenId, sesionDestinoId, convenioId } = await req.json();

  if (!sesionOrigenId || !sesionDestinoId) {
    return NextResponse.json({ error: "Faltan sesiones para el cambio" }, { status: 400 });
  }

  const sesionOrigenRealId = await resolverSesionId(sesionOrigenId);
  const sesionDestinoRealId = await resolverSesionId(sesionDestinoId);

  // Verificar que la sesión origen no ha empezado
  const sesionOrigen = await prisma.sesion.findUnique({ where: { id: sesionOrigenRealId } });
  if (!sesionOrigen) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  const ahora = new Date();
  const inicioParsed = new Date(sesionOrigen.fecha);
  const [h, m] = sesionOrigen.horaInicio.split(":").map(Number);
  inicioParsed.setHours(h, m, 0, 0);
  if (ahora >= inicioParsed) {
    return NextResponse.json({ error: "La clase ya ha empezado" }, { status: 400 });
  }

  // Determinar si requiere aprobación
  let requiereAprobacion = false;
  if (convenioId) {
    const convenio = await prisma.convenio.findUnique({ where: { id: convenioId } });
    requiereAprobacion = convenio?.requiereAprobacion || false;
  }

  const estado = requiereAprobacion ? "PENDIENTE" : "APROBADO";

  const cambio = await prisma.cambio.create({
    data: {
      userId: session.user.id,
      sesionOrigenId: sesionOrigenRealId,
      sesionDestinoId: sesionDestinoRealId,
      convenioId: convenioId || null,
      estado,
    },
    include: {
      sesionOrigen: { include: { clase: true } },
      sesionDestino: { include: { clase: true } },
    },
  });

  return NextResponse.json(cambio, { status: 201 });
}
