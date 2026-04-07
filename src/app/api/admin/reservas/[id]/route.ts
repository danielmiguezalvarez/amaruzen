import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendReservaRespondida } from "@/lib/email";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlap(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return toMinutes(aInicio) < toMinutes(bFin) && toMinutes(bInicio) < toMinutes(aFin);
}

// PUT /api/admin/reservas/[id]
// body: { estado: "APROBADA" | "RECHAZADA", notas?: string }
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { estado, notas } = await req.json();
  if (!["APROBADA", "RECHAZADA"].includes(estado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const reserva = await prisma.reserva.findUnique({
    where: { id: params.id },
    include: { sala: true },
  });

  if (!reserva) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  if (estado === "APROBADA") {
    // validar conflictos justo antes de aprobar
    const clasesSala = await prisma.clase.findMany({
      where: {
        activa: true,
        recurrente: true,
        salaId: reserva.salaId,
      },
    });

    const conflictoClase = clasesSala.some((clase) => {
      if (!clase.diaSemana) return false;
      const diaReserva = reserva.fecha.getDay();
      const diaClase = {
        DOMINGO: 0,
        LUNES: 1,
        MARTES: 2,
        MIERCOLES: 3,
        JUEVES: 4,
        VIERNES: 5,
        SABADO: 6,
      }[clase.diaSemana];

      if (diaReserva !== diaClase) return false;
      if (clase.fechaInicio && reserva.fecha < clase.fechaInicio) return false;
      if (clase.fechaFin && reserva.fecha > clase.fechaFin) return false;

      return overlap(reserva.horaInicio, reserva.horaFin, clase.horaInicio, clase.horaFin);
    });

    if (conflictoClase) {
      return NextResponse.json({ error: "Conflicto: la sala está ocupada por una clase" }, { status: 409 });
    }

    const reservasAprobadas = await prisma.reserva.findMany({
      where: {
        id: { not: reserva.id },
        salaId: reserva.salaId,
        fecha: reserva.fecha,
        estado: "APROBADA",
      },
    });

    const conflictoReserva = reservasAprobadas.some((r) =>
      overlap(reserva.horaInicio, reserva.horaFin, r.horaInicio, r.horaFin)
    );

    if (conflictoReserva) {
      return NextResponse.json({ error: "Conflicto: ya existe otra reserva aprobada" }, { status: 409 });
    }
  }

  const updated = await prisma.reserva.update({
    where: { id: params.id },
    data: {
      estado,
      notas: notas || null,
    },
    include: {
      sala: true,
      profesional: { select: { id: true, name: true, email: true } },
    },
  });

  if (updated.profesional.email) {
    await sendReservaRespondida({
      to: updated.profesional.email,
      nombre: updated.profesional.name || "Profesional",
      estado,
      fecha: updated.fecha,
      sala: updated.sala.nombre,
      horaInicio: updated.horaInicio,
      horaFin: updated.horaFin,
      notas: updated.notas,
    });
  }

  return NextResponse.json(updated);
}
