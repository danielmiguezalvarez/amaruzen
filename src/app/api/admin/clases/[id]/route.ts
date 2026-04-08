import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { generarSesionesPorRango } from "@/lib/sesiones";
import type { DiaSemana } from "@prisma/client";

type HorarioPayload = {
  id?: string | null;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  profesorId: string;
  salaId: string;
};

function horaValida(h: string) {
  return /^\d{2}:\d{2}$/.test(h);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlap(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return toMinutes(aInicio) < toMinutes(bFin) && toMinutes(bInicio) < toMinutes(aFin);
}

async function resolveTipoClaseId(tipoClaseId: string | undefined, tipoNombre: string | undefined, nombreClase: string) {
  if (tipoClaseId) return tipoClaseId;
  const nombreTipo = (tipoNombre || nombreClase).trim();
  const existente = await prisma.tipoClase.findFirst({ where: { nombre: nombreTipo } });
  if (existente) return existente.id;
  const tipo = await prisma.tipoClase.create({ data: { nombre: nombreTipo } });
  return tipo.id;
}

function validarConflictosInternos(horarios: HorarioPayload[]) {
  for (let i = 0; i < horarios.length; i++) {
    for (let j = i + 1; j < horarios.length; j++) {
      const a = horarios[i];
      const b = horarios[j];
      if (a.salaId === b.salaId && a.diaSemana === b.diaSemana && overlap(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin)) {
        return `Conflicto entre horarios de la misma clase: ${a.diaSemana} ${a.horaInicio}-${a.horaFin} y ${b.horaInicio}-${b.horaFin} en la misma sala`;
      }
    }
  }
  return null;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const {
    nombre,
    tipoNombre,
    tipoClaseId,
    profesorId,
    salaId,
    aforo,
    fechaFin,
    activa,
    color,
    horarios,
  } = await req.json();

  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);

  // Toggle rápido de estado (reactivar/desactivar) sin editar horarios
  if (typeof activa === "boolean" && !nombre && !horarios) {
    await prisma.clase.update({ where: { id: params.id }, data: { activa } });

    if (activa) {
      await prisma.sesion.updateMany({
        where: { claseId: params.id, fecha: { gte: ahora } },
        data: { cancelada: false },
      });

      const hasta = new Date(ahora);
      hasta.setDate(hasta.getDate() + 84);
      await generarSesionesPorRango(ahora, hasta);
    } else {
      await prisma.sesion.updateMany({
        where: { claseId: params.id, fecha: { gte: ahora } },
        data: { cancelada: true },
      });
    }

    return NextResponse.json({ ok: true });
  }

  const horariosEntrada: HorarioPayload[] =
    Array.isArray(horarios) && horarios.length > 0
      ? horarios
      : [];

  if (horariosEntrada.length === 0) {
    return NextResponse.json({ error: "Debes mantener al menos un horario" }, { status: 400 });
  }

  for (const h of horariosEntrada) {
    if (!h.diaSemana || !h.horaInicio || !h.horaFin || !h.profesorId || !h.salaId) {
      return NextResponse.json({ error: "Horario inválido: faltan campos" }, { status: 400 });
    }
    if (!horaValida(h.horaInicio) || !horaValida(h.horaFin) || h.horaInicio >= h.horaFin) {
      return NextResponse.json({ error: "Horario inválido: horas incorrectas" }, { status: 400 });
    }
  }

  const conflictoInterno = validarConflictosInternos(horariosEntrada);
  if (conflictoInterno) {
    return NextResponse.json({ error: conflictoInterno }, { status: 409 });
  }

  for (const h of horariosEntrada) {
    const conflictos = await prisma.horario.findMany({
      where: {
        activo: true,
        fecha: null,
        salaId: h.salaId,
        diaSemana: h.diaSemana,
        clase: { activa: true },
        id: h.id ? { not: h.id } : undefined,
      },
      select: { horaInicio: true, horaFin: true },
    });

    if (conflictos.some((x) => overlap(h.horaInicio, h.horaFin, x.horaInicio, x.horaFin))) {
      return NextResponse.json(
        { error: `Conflicto de sala: ya existe otra clase en ${h.diaSemana} ${h.horaInicio}-${h.horaFin}` },
        { status: 409 }
      );
    }
  }

  const tipoId = await resolveTipoClaseId(tipoClaseId, tipoNombre, nombre);

  const clase = await prisma.clase.update({
    where: { id: params.id },
    data: {
      nombre,
      tipoClaseId: tipoId,
      profesorId,
      salaId,
      aforo: Number(aforo),
      recurrente: true,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      color: color || null,
      activa,
    },
    include: { profesor: true, sala: true, tipoClase: true },
  });

  const horariosActivos = await prisma.horario.findMany({
    where: { claseId: params.id, activo: true, fecha: null },
    select: { id: true, diaSemana: true },
  });

  const idsEntrada = new Set(
    horariosEntrada
      .map((h) => h.id)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
  );

  const idsExistentes = new Set(horariosActivos.map((h) => h.id));
  const diaExistentePorId = new Map(
    horariosActivos.map((h) => [h.id, h.diaSemana])
  );

  // Desactivar horarios que ya no vienen en el payload
  const idsDesactivar = horariosActivos
    .map((h) => h.id)
    .filter((id) => !idsEntrada.has(id));

  if (idsDesactivar.length > 0) {
    await prisma.horario.updateMany({
      where: { id: { in: idsDesactivar } },
      data: { activo: false },
    });

    // Borrar sesiones futuras de horarios desactivados que no tengan cambios vinculados
    await prisma.sesion.deleteMany({
      where: {
        horarioId: { in: idsDesactivar },
        fecha: { gte: ahora },
        cambiosComoOrigen: { none: {} },
        cambiosComoDestino: { none: {} },
      },
    });
  }

  // Upsert de horarios entrantes
  for (const h of horariosEntrada) {
    if (h.id && idsExistentes.has(h.id)) {
      // Si cambió el día, borrar sesiones futuras del día viejo (quedarán huérfanas)
      const diaAnterior = diaExistentePorId.get(h.id);
      if (diaAnterior && diaAnterior !== h.diaSemana) {
        await prisma.sesion.deleteMany({
          where: {
            horarioId: h.id,
            fecha: { gte: ahora },
            cambiosComoOrigen: { none: {} },
            cambiosComoDestino: { none: {} },
          },
        });
      }

      await prisma.horario.update({
        where: { id: h.id },
        data: {
          profesorId: h.profesorId,
          salaId: h.salaId,
          diaSemana: h.diaSemana,
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
          aforo: Number(aforo),
          activo: true,
        },
      });
    } else {
      await prisma.horario.create({
        data: {
          claseId: params.id,
          profesorId: h.profesorId,
          salaId: h.salaId,
          diaSemana: h.diaSemana,
          fecha: null,
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
          aforo: Number(aforo),
          activo: true,
        },
      });
    }
  }

  // Actualizar metadatos de sesiones futuras de la clase

  await prisma.sesion.updateMany({
    where: {
      claseId: params.id,
      fecha: { gte: ahora },
    },
    data: {
      aforo: Number(aforo),
    },
  });

  // Si se añadió fechaFin, cancelar (o borrar) sesiones que queden fuera del rango
  if (fechaFin) {
    const limite = new Date(fechaFin);
    limite.setHours(23, 59, 59, 999);
    await prisma.sesion.deleteMany({
      where: {
        claseId: params.id,
        fecha: { gt: limite },
        // Solo borrar sesiones sin inscripciones activas vinculadas
        cambiosComoOrigen: { none: {} },
        cambiosComoDestino: { none: {} },
      },
    });
  }

  const hasta = new Date(ahora);
  hasta.setDate(hasta.getDate() + 84);
  await generarSesionesPorRango(ahora, hasta);

  return NextResponse.json(clase);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  await prisma.clase.update({ where: { id: params.id }, data: { activa: false } });
  await prisma.sesion.updateMany({
    where: {
      claseId: params.id,
      fecha: { gte: hoy },
    },
    data: { cancelada: true },
  });
  return NextResponse.json({ ok: true });
}
