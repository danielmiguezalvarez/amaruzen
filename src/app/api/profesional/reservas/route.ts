import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfesional } from "@/lib/api-auth";
import { generarSesionesPorRango, normalizarFecha } from "@/lib/sesiones";

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

  const { salaId, claseId, fecha, horaInicio, horaFin, motivo } = await req.json();

  if (!salaId || !claseId || !fecha || !horaInicio || !horaFin) {
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

  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    include: {
      horarios: {
        include: { profesor: { select: { userId: true, email: true } } },
      },
    },
  });
  const asignadaAlProfesional = Boolean(
    clase?.horarios.some(
      (h) =>
        (h.profesor.userId && h.profesor.userId === session.user.id) ||
        (h.profesor.email && h.profesor.email === session.user.email)
    )
  );
  if (!clase || !asignadaAlProfesional) {
    return NextResponse.json({ error: "Solo puedes reservar para clases que impartes" }, { status: 403 });
  }

  await generarSesionesPorRango(fechaReserva, fechaReserva);

  const sesionesSala = await prisma.sesion.findMany({
    where: {
      salaId,
      fecha: fechaReserva,
      cancelada: false,
      clase: { activa: true },
      horario: { activo: true },
    },
    select: { horaInicio: true, horaFin: true },
  });

  const conflictoClase = sesionesSala.some((s) => overlap(horaInicio, horaFin, s.horaInicio, s.horaFin));

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
      claseId,
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
