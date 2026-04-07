import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calcularOcupacionSesion, materializarSesion, normalizarFecha } from "@/lib/sesiones";
import type { DiaSemana } from "@prisma/client";

const DIA_A_JS: Record<DiaSemana, number> = {
  DOMINGO: 0,
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
};

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

function getInicioSesion(fecha: Date, horaInicio: string) {
  const inicio = new Date(fecha);
  const [h, m] = horaInicio.split(":").map(Number);
  inicio.setHours(h, m, 0, 0);
  return inicio;
}

function siguientesFechasClase(
  diaSemana: DiaSemana | null,
  desde: Date,
  limite: number,
  fechaInicio?: Date | null,
  fechaFin?: Date | null
) {
  if (!diaSemana) return [];

  const objetivo = DIA_A_JS[diaSemana];
  const cursor = normalizarFecha(desde);
  const diff = (objetivo - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + diff);

  const fechas: Date[] = [];
  while (fechas.length < limite) {
    if (fechaFin && cursor > normalizarFecha(fechaFin)) break;
    if (!fechaInicio || cursor >= normalizarFecha(fechaInicio)) {
      fechas.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return fechas;
}

// Devuelve las sesiones disponibles para cambiarse desde una sesión origen
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sesionOrigenId = searchParams.get("sesionOrigenId");
  if (!sesionOrigenId) return NextResponse.json({ error: "Falta sesionOrigenId" }, { status: 400 });

  const sesionOrigenRealId = await resolverSesionId(sesionOrigenId);

  const sesionOrigen = await prisma.sesion.findUnique({
    where: { id: sesionOrigenRealId },
    include: { clase: true },
  });
  if (!sesionOrigen) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  const ahora = new Date();

  // 1) Misma clase, otros horarios
  const fechasMismaClase = siguientesFechasClase(
    sesionOrigen.clase.diaSemana,
    normalizarFecha(ahora),
    12,
    sesionOrigen.clase.fechaInicio,
    sesionOrigen.clase.fechaFin
  ).filter((f) => f.getTime() !== normalizarFecha(sesionOrigen.fecha).getTime());

  const sesionesMismaClaseMaterializadas = await Promise.all(
    fechasMismaClase.map((fecha) => materializarSesion(sesionOrigen.claseId, fecha))
  );

  const mismaClaseSesiones = await prisma.sesion.findMany({
    where: { id: { in: sesionesMismaClaseMaterializadas.map((x) => x.sesion.id) } },
    include: { clase: { include: { profesor: true, sala: true } } },
    orderBy: { fecha: "asc" },
    take: 10,
  });

  const sesionesDisponiblesMismaClase = await Promise.all(
    mismaClaseSesiones.map(async (s) => {
      const inicio = getInicioSesion(s.fecha, s.horaInicio);
      if (inicio <= ahora || s.cancelada) return null;
      const ocupacion = await calcularOcupacionSesion(s.claseId, s.fecha, s.aforo);
      if (ocupacion.libres <= 0) return null;
      return { ...s, tipoConvenio: null as null };
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

  const sesionesConvenio: {
    id: string;
    fecha: Date;
    horaInicio: string;
    horaFin: string;
    aforo: number;
    cancelada: boolean;
    claseId: string;
    createdAt: Date;
    updatedAt: Date;
    clase: { nombre: string; profesor: { nombre: string }; sala: { nombre: string } };
    tipoConvenio: "EQUIVALENTE" | "EXCEPCIONAL";
    convenioId: string;
    requiereAprobacion: boolean;
  }[] = [];
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

    const claseDestino = await prisma.clase.findUnique({ where: { id: claseDestinoId } });
    if (!claseDestino) continue;

    const fechasDestino = siguientesFechasClase(
      claseDestino.diaSemana,
      normalizarFecha(ahora),
      8,
      claseDestino.fechaInicio,
      claseDestino.fechaFin
    );

    const sesionesMaterializadas = await Promise.all(
      fechasDestino.map((fecha) => materializarSesion(claseDestinoId, fecha))
    );

    const sesiones = await prisma.sesion.findMany({
      where: { id: { in: sesionesMaterializadas.map((x) => x.sesion.id) } },
      include: { clase: { include: { profesor: true, sala: true } } },
      orderBy: { fecha: "asc" },
      take: 5,
    });

    for (const s of sesiones) {
      const inicio = getInicioSesion(s.fecha, s.horaInicio);
      if (inicio <= ahora || s.cancelada) continue;
      const ocupacion = await calcularOcupacionSesion(s.claseId, s.fecha, s.aforo);
      if (ocupacion.libres > 0) {
        sesionesConvenio.push({ ...s, tipoConvenio: convenio.tipo, convenioId: convenio.id, requiereAprobacion: convenio.requiereAprobacion });
      }
    }
  }

  return NextResponse.json({
    mismaClase: sesionesDisponiblesMismaClase.filter(
      (s): s is NonNullable<typeof s> => Boolean(s)
    ),
    convenio: sesionesConvenio,
  });
}
