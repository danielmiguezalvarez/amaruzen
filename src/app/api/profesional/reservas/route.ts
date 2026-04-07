import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfesional } from "@/lib/api-auth";
import { normalizarFecha } from "@/lib/sesiones";
import type { DiaSemana } from "@prisma/client";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlap(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return toMinutes(aInicio) < toMinutes(bFin) && toMinutes(bInicio) < toMinutes(aFin);
}

// GET /api/profesional/reservas
export async function GET() {
  const auth = await requireProfesional();
  if (auth.error || !auth.session) return auth.error;

  const session = auth.session;

  const reservas = await prisma.reserva.findMany({
    where: { profesionalId: session.user.id },
    include: { sala: true },
    orderBy: [{ fecha: "desc" }, { horaInicio: "asc" }],
  });

  return NextResponse.json(reservas);
}

// POST /api/profesional/reservas
export async function POST(req: Request) {
  const auth = await requireProfesional();
  if (auth.error || !auth.session) return auth.error;

  const session = auth.session;

  const { salaId, fecha, horaInicio, horaFin, motivo } = await req.json();

  if (!salaId || !fecha || !horaInicio || !horaFin) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  if (toMinutes(horaInicio) >= toMinutes(horaFin)) {
    return NextResponse.json({ error: "La hora de inicio debe ser anterior a la de fin" }, { status: 400 });
  }

  const fechaReserva = normalizarFecha(new Date(fecha));
  if (Number.isNaN(fechaReserva.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const sala = await prisma.sala.findUnique({ where: { id: salaId } });
  if (!sala || !sala.activa) {
    return NextResponse.json({ error: "Sala no encontrada o inactiva" }, { status: 404 });
  }

  // Conflicto con clases recurrentes activas del mismo día y sala
  const diaJs = fechaReserva.getDay();
  const diaSemana = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][diaJs] as DiaSemana;

  const clasesSala = await prisma.clase.findMany({
    where: {
      activa: true,
      recurrente: true,
      salaId,
      diaSemana,
    },
  });

  const conflictoClase = clasesSala.some((clase) => {
    if (clase.fechaInicio && fechaReserva < normalizarFecha(clase.fechaInicio)) return false;
    if (clase.fechaFin && fechaReserva > normalizarFecha(clase.fechaFin)) return false;
    return overlap(horaInicio, horaFin, clase.horaInicio, clase.horaFin);
  });

  if (conflictoClase) {
    return NextResponse.json({ error: "La sala está ocupada por una clase en ese horario" }, { status: 409 });
  }

  // Conflicto con reservas ya aprobadas
  const reservasAprobadas = await prisma.reserva.findMany({
    where: { salaId, estado: "APROBADA", fecha: fechaReserva },
  });

  const conflictoReserva = reservasAprobadas.some((r) => overlap(horaInicio, horaFin, r.horaInicio, r.horaFin));
  if (conflictoReserva) {
    return NextResponse.json({ error: "La sala ya tiene una reserva aprobada en ese horario" }, { status: 409 });
  }

  const reserva = await prisma.reserva.create({
    data: {
      salaId,
      profesionalId: session.user.id,
      fecha: fechaReserva,
      horaInicio,
      horaFin,
      motivo: motivo || null,
      estado: "PENDIENTE",
    },
    include: { sala: true },
  });

  return NextResponse.json(reserva, { status: 201 });
}
