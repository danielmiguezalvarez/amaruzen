import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendNotificacionAdmin } from "@/lib/email";
import { Prisma } from "@prisma/client";
import {
  generarSesionesPorRango,
  normalizarFecha,
  resolverSesionId,
  resolverHorarioFechaDesdeRef,
} from "@/lib/sesiones";

async function notificarAdmins(asunto: string, mensaje: string) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", activo: true, notificaciones: true },
    select: { email: true },
  });
  try {
    await Promise.all(
      admins.map((a) => sendNotificacionAdmin({ to: a.email, asunto, mensaje }))
    );
  } catch {
    // Ignorar errores de email — la operación principal ya se completó
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const sesionRef = searchParams.get("sesionRef");
  if (!sesionRef) {
    return NextResponse.json({ error: "Falta sesionRef" }, { status: 400 });
  }

  const resolved = await resolverHorarioFechaDesdeRef(sesionRef);
  if (!resolved) {
    return NextResponse.json({ error: "Sesion no encontrada" }, { status: 404 });
  }
  const { horarioId, fecha } = resolved;

  let sesion = await prisma.sesion.findUnique({
    where: { horarioId_fecha: { horarioId, fecha } },
    include: {
      clase: { select: { id: true, nombre: true, color: true, activa: true } },
      profesor: { select: { id: true, nombre: true } },
      sala: { select: { id: true, nombre: true, color: true } },
    },
  });

  if (!sesion) {
    await generarSesionesPorRango(fecha, fecha);
    sesion = await prisma.sesion.findUnique({
      where: { horarioId_fecha: { horarioId, fecha } },
      include: {
        clase: { select: { id: true, nombre: true, color: true, activa: true } },
        profesor: { select: { id: true, nombre: true } },
        sala: { select: { id: true, nombre: true, color: true } },
      },
    });
  }

  if (!sesion || !sesion.clase.activa) {
    return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
  }

  const [ocupacionRow, alumnosRows] = await Promise.all([
    prisma.$queryRaw<Array<{
      inscritos: bigint;
      ausencias: bigint;
      cambiosEntrantes: bigint;
      cambiosSalientes: bigint;
    }>>(Prisma.sql`
      SELECT
        (
          SELECT COUNT(*)
          FROM "InscripcionHorario" ih
          JOIN "Inscripcion" i ON i."id" = ih."inscripcionId"
          WHERE ih."horarioId" = ${horarioId}
            AND ih."activa" = true
            AND i."activa" = true
        ) AS "inscritos",
        (
          SELECT COUNT(*)
          FROM "Ausencia" a
          WHERE a."horarioId" = ${horarioId}
            AND a."fecha" = ${fecha}
        ) AS "ausencias",
        (
          SELECT COUNT(*)
          FROM "Cambio" c
          JOIN "Sesion" sd ON sd."id" = c."sesionDestinoId"
          WHERE c."estado" IN ('PENDIENTE', 'APROBADO')
            AND sd."horarioId" = ${horarioId}
            AND sd."fecha" = ${fecha}
        ) AS "cambiosEntrantes",
        (
          SELECT COUNT(*)
          FROM "Cambio" c
          JOIN "Sesion" so ON so."id" = c."sesionOrigenId"
          WHERE c."estado" IN ('PENDIENTE', 'APROBADO')
            AND so."horarioId" = ${horarioId}
            AND so."fecha" = ${fecha}
        ) AS "cambiosSalientes"
    `),
    prisma.$queryRaw<Array<{
      id: string;
      name: string | null;
      email: string;
      ausente: boolean;
      cambioEntrante: boolean;
      cambioSaliente: boolean;
      esInscrito: boolean;
    }>>(Prisma.sql`
      WITH inscritos AS (
        SELECT u."id", u."name", u."email", true AS "esInscrito"
        FROM "InscripcionHorario" ih
        JOIN "Inscripcion" i ON i."id" = ih."inscripcionId"
        JOIN "User" u ON u."id" = i."userId"
        WHERE ih."horarioId" = ${horarioId}
          AND ih."activa" = true
          AND i."activa" = true
      ),
      entrantes AS (
        SELECT DISTINCT u."id", u."name", u."email", false AS "esInscrito"
        FROM "Cambio" c
        JOIN "Sesion" sd ON sd."id" = c."sesionDestinoId"
        JOIN "User" u ON u."id" = c."userId"
        WHERE c."estado" IN ('PENDIENTE', 'APROBADO')
          AND sd."horarioId" = ${horarioId}
          AND sd."fecha" = ${fecha}
          AND NOT EXISTS (
            SELECT 1 FROM inscritos ins WHERE ins."id" = u."id"
          )
      ),
      todos AS (
        SELECT * FROM inscritos
        UNION ALL
        SELECT * FROM entrantes
      )
      SELECT
        t."id",
        t."name",
        t."email",
        t."esInscrito",
        EXISTS (
          SELECT 1 FROM "Ausencia" a
          WHERE a."userId" = t."id"
            AND a."horarioId" = ${horarioId}
            AND a."fecha" = ${fecha}
        ) AS "ausente",
        EXISTS (
          SELECT 1
          FROM "Cambio" c
          JOIN "Sesion" sd ON sd."id" = c."sesionDestinoId"
          WHERE c."userId" = t."id"
            AND c."estado" IN ('PENDIENTE', 'APROBADO')
            AND sd."horarioId" = ${horarioId}
            AND sd."fecha" = ${fecha}
        ) AS "cambioEntrante",
        EXISTS (
          SELECT 1
          FROM "Cambio" c
          JOIN "Sesion" so ON so."id" = c."sesionOrigenId"
          WHERE c."userId" = t."id"
            AND c."estado" IN ('PENDIENTE', 'APROBADO')
            AND so."horarioId" = ${horarioId}
            AND so."fecha" = ${fecha}
        ) AS "cambioSaliente"
      FROM todos t
      ORDER BY COALESCE(t."name", t."email") ASC
    `),
  ]);

  const counts = ocupacionRow[0] || {
    inscritos: BigInt(0),
    ausencias: BigInt(0),
    cambiosEntrantes: BigInt(0),
    cambiosSalientes: BigInt(0),
  };
  const inscritos = Number(counts.inscritos);
  const ausenciasCount = Number(counts.ausencias);
  const cambiosEntrantesCount = Number(counts.cambiosEntrantes);
  const cambiosSalientesCount = Number(counts.cambiosSalientes);
  const ocupados = inscritos - ausenciasCount + cambiosEntrantesCount - cambiosSalientesCount;

  const ocupacion = {
    inscritos,
    ausencias: ausenciasCount,
    cambiosEntrantes: cambiosEntrantesCount,
    cambiosSalientes: cambiosSalientesCount,
    ocupados,
    libres: sesion.aforo - ocupados,
  };

  return NextResponse.json({
    sesion: {
      id: sesion.id,
      horarioId,
      claseId: sesion.claseId,
      fecha: normalizarFecha(fecha),
      horaInicio: sesion.horaInicio,
      horaFin: sesion.horaFin,
      aforo: sesion.aforo,
      cancelada: Boolean(sesion.cancelada),
      clase: {
        id: sesion.clase.id,
        nombre: sesion.clase.nombre,
        color: sesion.clase.color,
      },
      profesor: {
        id: sesion.profesor.id,
        nombre: sesion.profesor.nombre,
      },
      sala: {
        id: sesion.sala.id,
        nombre: sesion.sala.nombre,
        color: sesion.sala.color,
      },
    },
    ocupacion,
    alumnos: alumnosRows,
  });
}

// POST /api/admin/sesiones/ficha
// body: { userId, sesionOrigenId, sesionDestinoId?, tipo: "CAMBIO"|"AUSENCIA", permanente?, convenioId? }
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { userId, sesionOrigenId, sesionDestinoId, tipo, permanente, convenioId } = await req.json();
  if (!userId || !sesionOrigenId || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const origenId = await resolverSesionId(sesionOrigenId);
  if (!origenId) {
    return NextResponse.json({ error: "Sesión origen no encontrada" }, { status: 404 });
  }

  const sesionOrigen = await prisma.sesion.findUnique({ where: { id: origenId } });
  if (!sesionOrigen) {
    return NextResponse.json({ error: "Sesión origen no encontrada" }, { status: 404 });
  }

  if (tipo === "AUSENCIA") {
    const alumno = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const horario = await prisma.horario.findUnique({ where: { id: sesionOrigen.horarioId }, include: { clase: true } });

    await prisma.ausencia.upsert({
      where: {
        userId_horarioId_fecha: {
          userId,
          horarioId: sesionOrigen.horarioId,
          fecha: normalizarFecha(sesionOrigen.fecha),
        },
      },
      update: {},
      create: {
        userId,
        horarioId: sesionOrigen.horarioId,
        fecha: normalizarFecha(sesionOrigen.fecha),
        creadoPorId: auth.session!.user.id,
      },
    });

    if (alumno && horario) {
      await notificarAdmins(
        "Ausencia registrada — Amaruzen",
        `Se registró ausencia de ${alumno.name || alumno.email} en ${horario.clase.nombre} (${sesionOrigen.fecha.toLocaleDateString("es-ES")} ${sesionOrigen.horaInicio}).`
      );
    }

    return NextResponse.json({ ok: true, tipo: "AUSENCIA" }, { status: 201 });
  }

  if (!sesionDestinoId) {
    return NextResponse.json({ error: "Falta sesión destino" }, { status: 400 });
  }

  const destinoId = await resolverSesionId(sesionDestinoId);
  if (!destinoId) {
    return NextResponse.json({ error: "Sesión destino no encontrada" }, { status: 404 });
  }

  const sesionDestino = await prisma.sesion.findUnique({ where: { id: destinoId } });
  if (!sesionDestino) {
    return NextResponse.json({ error: "Sesión destino no encontrada" }, { status: 404 });
  }

  if (permanente) {
    const inscripcionOrigen = await prisma.inscripcion.findFirst({
      where: { userId, claseId: sesionOrigen.claseId, activa: true },
    });
    if (!inscripcionOrigen) {
      return NextResponse.json({ error: "Inscripción origen no encontrada" }, { status: 404 });
    }

    await prisma.inscripcionHorario.updateMany({
      where: { inscripcionId: inscripcionOrigen.id, horarioId: sesionOrigen.horarioId },
      data: { activa: false },
    });

    const inscripcionDestino = await prisma.inscripcion.upsert({
      where: { userId_claseId: { userId, claseId: sesionDestino.claseId } },
      update: { activa: true },
      create: { userId, claseId: sesionDestino.claseId, activa: true },
    });

    await prisma.inscripcionHorario.upsert({
      where: {
        inscripcionId_horarioId: {
          inscripcionId: inscripcionDestino.id,
          horarioId: sesionDestino.horarioId,
        },
      },
      update: { activa: true },
      create: {
        inscripcionId: inscripcionDestino.id,
        horarioId: sesionDestino.horarioId,
        activa: true,
      },
    });

    return NextResponse.json({ ok: true, tipo: "PERMANENTE" }, { status: 201 });
  }

  const cambio = await prisma.cambio.create({
    data: {
      userId,
      sesionOrigenId: sesionOrigen.id,
      sesionDestinoId: sesionDestino.id,
      convenioId: convenioId || null,
      estado: "APROBADO",
    },
  });

  const [alumno, claseOrigen, claseDestino] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.clase.findUnique({ where: { id: sesionOrigen.claseId }, select: { nombre: true } }),
    prisma.clase.findUnique({ where: { id: sesionDestino.claseId }, select: { nombre: true } }),
  ]);

  if (alumno && claseOrigen && claseDestino) {
    await notificarAdmins(
      "Cambio de sesión registrado — Amaruzen",
      `${alumno.name || alumno.email} fue movido de ${claseOrigen.nombre} a ${claseDestino.nombre} para el ${sesionDestino.fecha.toLocaleDateString("es-ES")} ${sesionDestino.horaInicio}.`
    );
  }

  return NextResponse.json({ ok: true, tipo: "CAMBIO", cambio }, { status: 201 });
}

// DELETE /api/admin/sesiones/ficha
// body: { userId, sesionRef }
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { userId, sesionRef } = await req.json();
  if (!userId || !sesionRef) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const resolved = await resolverHorarioFechaDesdeRef(sesionRef);
  if (!resolved) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  await prisma.ausencia.deleteMany({
    where: {
      userId,
      horarioId: resolved.horarioId,
      fecha: resolved.fecha,
    },
  });

  return NextResponse.json({ ok: true });
}
