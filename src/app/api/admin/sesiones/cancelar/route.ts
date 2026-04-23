import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendClaseCancelada } from "@/lib/email";
import {
  generarSesionesPorRango,
  normalizarFecha,
  resolverHorarioFechaDesdeRef,
  resolverHorarioId,
} from "@/lib/sesiones";

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return normalizarFecha(d);
}

function buildDateRange(inicio: Date, fin: Date) {
  const fechas: Date[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fin) {
    fechas.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return fechas;
}

async function notificarCancelacion(horarioId: string, fecha: Date) {
  const inscripciones = await prisma.inscripcionHorario.findMany({
    where: {
      horarioId,
      activa: true,
      inscripcion: { activa: true },
    },
    include: {
      inscripcion: {
        include: {
          user: true,
          clase: { select: { nombre: true } },
        },
      },
    },
  });

  try {
    await Promise.all(
      inscripciones.map(async (ih) => {
        const alumno = ih.inscripcion.user;
        if (!alumno.notificaciones) return;
        await sendClaseCancelada({
          to: alumno.email,
          nombre: alumno.name || "Alumno",
          claseNombre: ih.inscripcion.clase.nombre,
          fecha,
        });
      })
    );
  } catch {
    // Ignorar errores de email — la operación principal ya se completó
  }
}

// POST /api/admin/sesiones/cancelar
// body:
// - { sesionRef, motivo }
// - { horarioId, fecha, motivo }
// - { horarioId, fechaInicio, fechaFin, motivo }
// - { fechaInicio, fechaFin, motivo } => cierre total del centro
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { sesionRef, horarioId: horarioIdBody, fecha, fechaInicio, fechaFin } = await req.json();

  const unicaFecha = parseDate(fecha);
  const inicio = parseDate(fechaInicio);
  const fin = parseDate(fechaFin);

  if (sesionRef) {
    const parsed = await resolverHorarioFechaDesdeRef(sesionRef);
    if (!parsed) return NextResponse.json({ error: "sesionRef inválido" }, { status: 400 });

    await generarSesionesPorRango(parsed.fecha, parsed.fecha);

    await prisma.sesion.updateMany({
      where: { horarioId: parsed.horarioId, fecha: parsed.fecha },
      data: { cancelada: true },
    });
    await notificarCancelacion(parsed.horarioId, parsed.fecha);
    return NextResponse.json({ ok: true, scope: "sesion" });
  }

  if (horarioIdBody && unicaFecha) {
    const horarioId = await resolverHorarioId(horarioIdBody);
    if (!horarioId) return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });

    await generarSesionesPorRango(unicaFecha, unicaFecha);

    await prisma.sesion.updateMany({
      where: { horarioId, fecha: unicaFecha },
      data: { cancelada: true },
    });
    await notificarCancelacion(horarioId, unicaFecha);
    return NextResponse.json({ ok: true, scope: "sesion" });
  }

  if (horarioIdBody && inicio && fin) {
    const horarioId = await resolverHorarioId(horarioIdBody);
    if (!horarioId) return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });

    const horario = await prisma.horario.findUnique({
      where: { id: horarioId },
      include: { clase: true },
    });
    if (!horario || !horario.activo || !horario.clase.activa) {
      return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
    }

    const fechas = buildDateRange(inicio, fin).filter((d) => {
      if (horario.fecha) return normalizarFecha(horario.fecha).getTime() === d.getTime();
      if (!horario.diaSemana) return false;
      return d.getDay() === ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"].indexOf(horario.diaSemana);
    });

    await generarSesionesPorRango(inicio, fin);

    const fechasValidas = fechas.filter((f) => {
      if (horario.clase.fechaInicio && f < normalizarFecha(horario.clase.fechaInicio)) return false;
      if (horario.clase.fechaFin && f > normalizarFecha(horario.clase.fechaFin)) return false;
      return true;
    });

    if (fechasValidas.length > 0) {
      await prisma.sesion.updateMany({
        where: { horarioId, fecha: { in: fechasValidas } },
        data: { cancelada: true },
      });
    }

    for (const f of fechasValidas) {
      await notificarCancelacion(horarioId, f);
    }

    return NextResponse.json({ ok: true, scope: "rango", total: fechasValidas.length });
  }

  if (!horarioIdBody && inicio && fin) {
    await generarSesionesPorRango(inicio, fin);

    const sesiones = await prisma.sesion.findMany({
      where: {
        fecha: { gte: inicio, lte: fin },
        clase: { activa: true },
        horario: { activo: true },
      },
      select: { horarioId: true, fecha: true },
    });

    await prisma.sesion.updateMany({
      where: {
        fecha: { gte: inicio, lte: fin },
        clase: { activa: true },
        horario: { activo: true },
      },
      data: { cancelada: true },
    });

    for (const s of sesiones) {
      await notificarCancelacion(s.horarioId, s.fecha);
    }

    return NextResponse.json({ ok: true, scope: "cierre_total", total: sesiones.length });
  }

  return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
}

// DELETE /api/admin/sesiones/cancelar
// body: { horarioId|sesionRef, fecha }
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { horarioId: horarioIdBody, sesionRef, fecha } = await req.json();
  const d = parseDate(fecha);
  if (!d) {
    return NextResponse.json({ error: "Falta fecha" }, { status: 400 });
  }

  let horarioId: string | null = null;
  if (sesionRef) {
    const parsed = await resolverHorarioFechaDesdeRef(sesionRef);
    horarioId = parsed?.horarioId || null;
  } else if (horarioIdBody) {
    horarioId = await resolverHorarioId(horarioIdBody);
  }

  if (!horarioId) {
    return NextResponse.json({ error: "Falta horarioId o sesionRef" }, { status: 400 });
  }

  await generarSesionesPorRango(d, d);

  await prisma.sesion.updateMany({
    where: { horarioId, fecha: d },
    data: { cancelada: false },
  });

  return NextResponse.json({ ok: true });
}
