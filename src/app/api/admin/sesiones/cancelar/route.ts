import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendClaseCancelada } from "@/lib/email";
import { normalizarFecha, parseSesionRef, resolverHorarioId } from "@/lib/sesiones";

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

  const { sesionRef, horarioId: horarioIdBody, fecha, fechaInicio, fechaFin, motivo } = await req.json();

  const unicaFecha = parseDate(fecha);
  const inicio = parseDate(fechaInicio);
  const fin = parseDate(fechaFin);

  if (sesionRef) {
    const parsed = parseSesionRef(sesionRef);
    if (!parsed) return NextResponse.json({ error: "sesionRef inválido" }, { status: 400 });

    await prisma.sesionExcepcion.upsert({
      where: { horarioId_fecha: { horarioId: parsed.horarioId, fecha: parsed.fecha } },
      update: { tipo: "CANCELADA", motivo: motivo || null },
      create: { horarioId: parsed.horarioId, fecha: parsed.fecha, tipo: "CANCELADA", motivo: motivo || null },
    });
    await notificarCancelacion(parsed.horarioId, parsed.fecha);
    return NextResponse.json({ ok: true, scope: "sesion" });
  }

  if (horarioIdBody && unicaFecha) {
    const horarioId = await resolverHorarioId(horarioIdBody);
    if (!horarioId) return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });

    await prisma.sesionExcepcion.upsert({
      where: { horarioId_fecha: { horarioId, fecha: unicaFecha } },
      update: { tipo: "CANCELADA", motivo: motivo || null },
      create: { horarioId, fecha: unicaFecha, tipo: "CANCELADA", motivo: motivo || null },
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

    let total = 0;
    for (const f of fechas) {
      if (horario.clase.fechaInicio && f < normalizarFecha(horario.clase.fechaInicio)) continue;
      if (horario.clase.fechaFin && f > normalizarFecha(horario.clase.fechaFin)) continue;

      await prisma.sesionExcepcion.upsert({
        where: { horarioId_fecha: { horarioId, fecha: f } },
        update: { tipo: "CANCELADA", motivo: motivo || null },
        create: { horarioId, fecha: f, tipo: "CANCELADA", motivo: motivo || null },
      });
      await notificarCancelacion(horarioId, f);
      total++;
    }

    return NextResponse.json({ ok: true, scope: "rango", total });
  }

  if (!horarioIdBody && inicio && fin) {
    const horarios = await prisma.horario.findMany({
      where: { activo: true, clase: { activa: true } },
      include: { clase: true },
    });

    let total = 0;
    for (const horario of horarios) {
      const fechas = buildDateRange(inicio, fin).filter((d) => {
        if (horario.fecha) return normalizarFecha(horario.fecha).getTime() === d.getTime();
        if (!horario.diaSemana) return false;
        return d.getDay() === ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"].indexOf(horario.diaSemana);
      });

      for (const f of fechas) {
        if (horario.clase.fechaInicio && f < normalizarFecha(horario.clase.fechaInicio)) continue;
        if (horario.clase.fechaFin && f > normalizarFecha(horario.clase.fechaFin)) continue;

        await prisma.sesionExcepcion.upsert({
          where: { horarioId_fecha: { horarioId: horario.id, fecha: f } },
          update: { tipo: "CANCELADA", motivo: motivo || null },
          create: { horarioId: horario.id, fecha: f, tipo: "CANCELADA", motivo: motivo || null },
        });
        await notificarCancelacion(horario.id, f);
        total++;
      }
    }

    return NextResponse.json({ ok: true, scope: "cierre_total", total });
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
    const parsed = parseSesionRef(sesionRef);
    horarioId = parsed?.horarioId || null;
  } else if (horarioIdBody) {
    horarioId = await resolverHorarioId(horarioIdBody);
  }

  if (!horarioId) {
    return NextResponse.json({ error: "Falta horarioId o sesionRef" }, { status: 400 });
  }

  await prisma.sesionExcepcion.deleteMany({
    where: { horarioId, fecha: d, tipo: "CANCELADA" },
  });

  return NextResponse.json({ ok: true });
}
