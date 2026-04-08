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

// POST body: { claseId, salaId, profesorId?, fecha, horaInicio, horaFin, aforo? }
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId, salaId, profesorId, fecha, horaInicio, horaFin, aforo } = await req.json();
  if (!claseId || !salaId || !fecha || !horaInicio || !horaFin) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  if (toMinutes(horaInicio) >= toMinutes(horaFin)) {
    return NextResponse.json({ error: "La hora de inicio debe ser anterior a la de fin" }, { status: 400 });
  }

  const fechaNorm = normalizarFecha(new Date(fecha));
  if (Number.isNaN(fechaNorm.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const clase = await prisma.clase.findUnique({ where: { id: claseId } });
  if (!clase || !clase.activa) {
    return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  }

  const sala = await prisma.sala.findUnique({ where: { id: salaId } });
  if (!sala || !sala.activa) {
    return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
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
      claseId,
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
