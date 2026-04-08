import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { generarSesionesPorRango, normalizarFecha } from "@/lib/sesiones";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlap(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return toMinutes(aInicio) < toMinutes(bFin) && toMinutes(bInicio) < toMinutes(aFin);
}

// POST body:
//   Con clase existente: { claseId, salaId, profesorId?, fecha, horaInicio, horaFin, aforo? }
//   Independiente:       { nombre, profesorId, salaId, fecha, horaInicio, horaFin, aforo? }
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json();
  const { salaId, fecha, horaInicio, horaFin, aforo } = body;
  let { claseId } = body as { claseId?: string };
  const nombre = body.nombre as string | undefined;
  const profesorId = body.profesorId as string | undefined;

  // Validar: o viene claseId (clase existente) o viene nombre+profesorId (independiente)
  const esIndependiente = !claseId && !!nombre;
  if (!claseId && !esIndependiente) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }
  if (!salaId || !fecha || !horaInicio || !horaFin) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }
  if (esIndependiente && !profesorId) {
    return NextResponse.json({ error: "Se requiere un profesor para la sesión independiente" }, { status: 400 });
  }

  if (toMinutes(horaInicio) >= toMinutes(horaFin)) {
    return NextResponse.json({ error: "La hora de inicio debe ser anterior a la de fin" }, { status: 400 });
  }

  const fechaNorm = normalizarFecha(new Date(fecha));
  if (Number.isNaN(fechaNorm.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const sala = await prisma.sala.findUnique({ where: { id: salaId } });
  if (!sala || !sala.activa) {
    return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  // Si es independiente, auto-crear Clase con recurrente=false
  let clase: { id: string; profesorId: string; aforo: number };
  if (esIndependiente) {
    const tipo = await prisma.tipoClase.create({ data: { nombre: nombre! } });
    const nuevaClase = await prisma.clase.create({
      data: {
        nombre: nombre!,
        tipoClaseId: tipo.id,
        profesorId: profesorId!,
        salaId,
        aforo: Number(aforo) || sala.aforo,
        recurrente: false,
      },
    });
    claseId = nuevaClase.id;
    clase = nuevaClase;
  } else {
    const found = await prisma.clase.findUnique({ where: { id: claseId } });
    if (!found || !found.activa) {
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }
    clase = found;
  }

  const profId = profesorId || clase.profesorId;

  await generarSesionesPorRango(fechaNorm, fechaNorm);

  const conflictosSesiones = await prisma.sesion.findMany({
    where: {
      salaId,
      fecha: fechaNorm,
      clase: { activa: true },
      horario: { activo: true },
    },
    select: { horaInicio: true, horaFin: true },
  });

  for (const s of conflictosSesiones) {
    if (overlap(horaInicio, horaFin, s.horaInicio, s.horaFin)) {
      return NextResponse.json({ error: "La sala ya está ocupada en ese tramo" }, { status: 409 });
    }
  }

  const reservas = await prisma.reserva.findMany({
    where: { salaId, estado: "APROBADA", fecha: fechaNorm },
  });

  if (reservas.some((r) => overlap(horaInicio, horaFin, r.horaInicio, r.horaFin))) {
    return NextResponse.json({ error: "Conflicto con una reserva aprobada" }, { status: 409 });
  }

  const horario = await prisma.horario.create({
    data: {
      claseId: claseId!,
      profesorId: profId,
      salaId,
      diaSemana: null,
      fecha: fechaNorm,
      horaInicio,
      horaFin,
      aforo: Number(aforo) || clase.aforo || sala.aforo,
      activo: true,
    },
    include: {
      clase: true,
      profesor: true,
      sala: true,
    },
  });

  await generarSesionesPorRango(fechaNorm, fechaNorm);

  return NextResponse.json(horario, { status: 201 });
}
