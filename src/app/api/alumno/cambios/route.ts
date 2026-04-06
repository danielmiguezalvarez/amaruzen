import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

  // Verificar que la sesión origen no ha empezado
  const sesionOrigen = await prisma.sesion.findUnique({ where: { id: sesionOrigenId } });
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
      sesionOrigenId,
      sesionDestinoId,
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
