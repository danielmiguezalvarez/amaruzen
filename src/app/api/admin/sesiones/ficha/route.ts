import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendNotificacionAdmin } from "@/lib/email";
import {
  calcularOcupacionSesion,
  normalizarFecha,
  resolverSesionId,
  resolverHorarioFechaDesdeRef,
} from "@/lib/sesiones";

async function notificarAdmins(asunto: string, mensaje: string) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", activo: true, notificaciones: true },
    select: { email: true },
  });
  await Promise.all(
    admins.map((a) => sendNotificacionAdmin({ to: a.email, asunto, mensaje }))
  );
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

  const horario = await prisma.horario.findUnique({
    where: { id: horarioId },
    include: {
      profesor: true,
      sala: true,
      clase: {
        include: { tipoClase: true },
      },
    },
  });

  if (!horario || !horario.clase.activa) {
    return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
  }

  const alumnosInscritos = await prisma.inscripcionHorario.findMany({
    where: {
      horarioId,
      activa: true,
      inscripcion: { activa: true },
    },
    include: {
      inscripcion: {
        include: { user: true },
      },
    },
  });

  const [ausencias, cambiosEntrantes, cambiosSalientes, sesionMaterializada] = await Promise.all([
    prisma.ausencia.findMany({
      where: { horarioId, fecha },
      include: { user: true },
    }),
    prisma.cambio.findMany({
      where: {
        estado: { in: ["PENDIENTE", "APROBADO"] },
        sesionDestino: { horarioId, fecha },
      },
      include: { user: true },
    }),
    prisma.cambio.findMany({
      where: {
        estado: { in: ["PENDIENTE", "APROBADO"] },
        sesionOrigen: { horarioId, fecha },
      },
      include: { user: true },
    }),
    prisma.sesion.findUnique({ where: { horarioId_fecha: { horarioId, fecha } } }),
  ]);

  const ocupacion = await calcularOcupacionSesion(horarioId, fecha, sesionMaterializada?.aforo ?? horario.aforo);

  const ausentesIds = new Set(ausencias.map((a) => a.userId));
  const entrantesIds = new Set(cambiosEntrantes.map((c) => c.userId));
  const salientesIds = new Set(cambiosSalientes.map((c) => c.userId));

  return NextResponse.json({
    sesion: {
      id: sesionMaterializada?.id || null,
      horarioId,
      claseId: horario.claseId,
      fecha: normalizarFecha(fecha),
      horaInicio: sesionMaterializada?.horaInicio || horario.horaInicio,
      horaFin: sesionMaterializada?.horaFin || horario.horaFin,
      aforo: sesionMaterializada?.aforo ?? horario.aforo,
      cancelada: Boolean(sesionMaterializada?.cancelada),
      clase: {
        id: horario.clase.id,
        nombre: horario.clase.nombre,
        color: horario.clase.color,
      },
      profesor: {
        id: horario.profesor.id,
        nombre: horario.profesor.nombre,
      },
      sala: {
        id: horario.sala.id,
        nombre: horario.sala.nombre,
        color: horario.sala.color,
      },
    },
    ocupacion,
    alumnos: alumnosInscritos.map((ih) => ({
      id: ih.inscripcion.user.id,
      name: ih.inscripcion.user.name,
      email: ih.inscripcion.user.email,
      ausente: ausentesIds.has(ih.inscripcion.user.id),
      cambioEntrante: entrantesIds.has(ih.inscripcion.user.id),
      cambioSaliente: salientesIds.has(ih.inscripcion.user.id),
    })),
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
