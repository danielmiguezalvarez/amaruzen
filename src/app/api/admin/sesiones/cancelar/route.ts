import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendClaseCancelada } from "@/lib/email";
import { normalizarFecha } from "@/lib/sesiones";

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return normalizarFecha(d);
}

async function notificarCancelacion(claseId: string, fecha: Date) {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    include: {
      inscripciones: { where: { activa: true }, include: { user: true } },
    },
  });
  if (!clase) return;

  await Promise.all(
    clase.inscripciones.map(async (insc) => {
      if (!insc.user.notificaciones) return;
      await sendClaseCancelada({
        to: insc.user.email,
        nombre: insc.user.name || "Alumno",
        claseNombre: clase.nombre,
        fecha,
      });
    })
  );
}

// POST /api/admin/sesiones/cancelar
// body:
// - { claseId, fecha }
// - { claseId, fechaInicio, fechaFin }
// - { fechaInicio, fechaFin } => cierre total
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId, fecha, fechaInicio, fechaFin, motivo } = await req.json();

  const unicaFecha = parseDate(fecha);
  const inicio = parseDate(fechaInicio);
  const fin = parseDate(fechaFin);

  if (unicaFecha && claseId) {
    await prisma.sesionExcepcion.upsert({
      where: { claseId_fecha: { claseId, fecha: unicaFecha } },
      update: { tipo: "CANCELADA", motivo: motivo || null },
      create: { claseId, fecha: unicaFecha, tipo: "CANCELADA", motivo: motivo || null },
    });
    await notificarCancelacion(claseId, unicaFecha);
    return NextResponse.json({ ok: true, scope: "sesion" });
  }

  if (claseId && inicio && fin) {
    const clase = await prisma.clase.findUnique({ where: { id: claseId } });
    if (!clase || !clase.diaSemana) {
      return NextResponse.json({ error: "Clase no encontrada o sin diaSemana" }, { status: 404 });
    }

    const mapDia: Record<string, number> = {
      DOMINGO: 0,
      LUNES: 1,
      MARTES: 2,
      MIERCOLES: 3,
      JUEVES: 4,
      VIERNES: 5,
      SABADO: 6,
    };
    const targetDay = mapDia[clase.diaSemana];

    const cursor = new Date(inicio);
    const diff = (targetDay - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    let total = 0;
    while (cursor <= fin) {
      const fechaSesion = new Date(cursor);
      await prisma.sesionExcepcion.upsert({
        where: { claseId_fecha: { claseId, fecha: fechaSesion } },
        update: { tipo: "CANCELADA", motivo: motivo || null },
        create: { claseId, fecha: fechaSesion, tipo: "CANCELADA", motivo: motivo || null },
      });
      await notificarCancelacion(claseId, fechaSesion);
      total++;
      cursor.setDate(cursor.getDate() + 7);
    }

    return NextResponse.json({ ok: true, scope: "rango", total });
  }

  if (!claseId && inicio && fin) {
    const clases = await prisma.clase.findMany({ where: { activa: true, recurrente: true, diaSemana: { not: null } } });
    let total = 0;

    for (const clase of clases) {
      const mapDia: Record<string, number> = {
        DOMINGO: 0,
        LUNES: 1,
        MARTES: 2,
        MIERCOLES: 3,
        JUEVES: 4,
        VIERNES: 5,
        SABADO: 6,
      };
      const targetDay = mapDia[clase.diaSemana!];

      const cursor = new Date(inicio);
      const diff = (targetDay - cursor.getDay() + 7) % 7;
      cursor.setDate(cursor.getDate() + diff);

      while (cursor <= fin) {
        const fechaSesion = new Date(cursor);
        await prisma.sesionExcepcion.upsert({
          where: { claseId_fecha: { claseId: clase.id, fecha: fechaSesion } },
          update: { tipo: "CANCELADA", motivo: motivo || null },
          create: { claseId: clase.id, fecha: fechaSesion, tipo: "CANCELADA", motivo: motivo || null },
        });
        await notificarCancelacion(clase.id, fechaSesion);
        total++;
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    return NextResponse.json({ ok: true, scope: "cierre_total", total });
  }

  return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
}

// DELETE /api/admin/sesiones/cancelar
// body: { claseId, fecha }
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId, fecha } = await req.json();
  const d = parseDate(fecha);
  if (!claseId || !d) {
    return NextResponse.json({ error: "Faltan claseId o fecha" }, { status: 400 });
  }

  await prisma.sesionExcepcion.deleteMany({
    where: { claseId, fecha: d, tipo: "CANCELADA" },
  });

  return NextResponse.json({ ok: true });
}
