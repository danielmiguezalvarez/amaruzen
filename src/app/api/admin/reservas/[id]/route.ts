import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendReservaRespondida } from "@/lib/email";
import { generarSesionesPorRango, normalizarFecha } from "@/lib/sesiones";

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
    const fechaReserva = normalizarFecha(reserva.fecha);
    await generarSesionesPorRango(fechaReserva, fechaReserva);

    const sesionesSala = await prisma.sesion.findMany({
      where: {
        salaId: reserva.salaId,
        fecha: fechaReserva,
        cancelada: false,
        clase: { activa: true },
        horario: { activo: true },
      },
      select: { horaInicio: true, horaFin: true },
    });

    const conflictoClase = sesionesSala.some((s) =>
      overlap(reserva.horaInicio, reserva.horaFin, s.horaInicio, s.horaFin)
    );

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
    try {
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
    } catch {
      // Ignorar errores de email — la operación principal ya se completó
    }
  }

  return NextResponse.json(updated);
}
