import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Devuelve las sesiones disponibles para cambiarse desde una sesión origen
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sesionOrigenId = searchParams.get("sesionOrigenId");
  if (!sesionOrigenId) return NextResponse.json({ error: "Falta sesionOrigenId" }, { status: 400 });

  const sesionOrigen = await prisma.sesion.findUnique({
    where: { id: sesionOrigenId },
    include: { clase: true },
  });
  if (!sesionOrigen) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  const ahora = new Date();

  // 1. Misma clase, otros horarios (sesiones futuras con hueco)
  const mismaClaseSesiones = await prisma.sesion.findMany({
    where: {
      claseId: sesionOrigen.claseId,
      id: { not: sesionOrigenId },
      fecha: { gt: ahora },
      cancelada: false,
    },
    include: { clase: { include: { profesor: true, sala: true } } },
    orderBy: { fecha: "asc" },
    take: 10,
  });

  // Filtrar por hueco disponible
  const sesionesDisponiblesMismaClase = await Promise.all(
    mismaClaseSesiones.map(async (s) => {
      const ocupados = await prisma.cambio.count({
        where: { sesionDestinoId: s.id, estado: { in: ["PENDIENTE", "APROBADO"] } },
      });
      const inscritosBase = await prisma.inscripcion.count({
        where: { claseId: s.claseId, activa: true },
      });
      return { ...s, disponible: inscritosBase + ocupados < s.aforo, tipoConvenio: null as null };
    })
  );

  // 2. Sesiones de clases con convenio activo
  const convenios = await prisma.convenio.findMany({
    where: {
      activo: true,
      OR: [
        { claseAId: sesionOrigen.claseId },
        { claseBId: sesionOrigen.claseId },
      ],
    },
    include: { claseA: true, claseB: true },
  });

  const sesionesConvenio: any[] = [];
  for (const convenio of convenios) {
    const claseDestinoId = convenio.claseAId === sesionOrigen.claseId ? convenio.claseBId : convenio.claseAId;

    // Contar cambios ya usados este mes por este convenio
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const cambiosEsteMes = await prisma.cambio.count({
      where: {
        userId: session.user.id,
        convenioId: convenio.id,
        estado: { in: ["PENDIENTE", "APROBADO"] },
        createdAt: { gte: inicioMes },
      },
    });

    if (cambiosEsteMes >= convenio.limiteMensual) continue;

    const sesiones = await prisma.sesion.findMany({
      where: {
        claseId: claseDestinoId,
        fecha: { gt: ahora },
        cancelada: false,
      },
      include: { clase: { include: { profesor: true, sala: true } } },
      orderBy: { fecha: "asc" },
      take: 5,
    });

    for (const s of sesiones) {
      const ocupados = await prisma.cambio.count({
        where: { sesionDestinoId: s.id, estado: { in: ["PENDIENTE", "APROBADO"] } },
      });
      const inscritosBase = await prisma.inscripcion.count({
        where: { claseId: s.claseId, activa: true },
      });
      if (inscritosBase + ocupados < s.aforo) {
        sesionesConvenio.push({ ...s, tipoConvenio: convenio.tipo, convenioId: convenio.id, requiereAprobacion: convenio.requiereAprobacion });
      }
    }
  }

  return NextResponse.json({
    mismaClase: sesionesDisponiblesMismaClase.filter((s) => s.disponible),
    convenio: sesionesConvenio,
  });
}
