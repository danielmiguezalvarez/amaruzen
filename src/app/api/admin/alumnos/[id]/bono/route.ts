import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { resolverSesionId } from "@/lib/sesiones";

function inicioSesion(fecha: Date, horaInicio: string) {
  const d = new Date(fecha);
  const [h, m] = horaInicio.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId, ajuste } = await req.json();
  if (!claseId || typeof ajuste !== "number" || ajuste === 0) {
    return NextResponse.json({ error: "Falta claseId o ajuste inválido" }, { status: 400 });
  }

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { userId_claseId: { userId: params.id, claseId } },
    select: { id: true, activa: true, modalidad: true, creditosDisponibles: true, creditosIniciales: true },
  });
  if (!inscripcion || !inscripcion.activa || inscripcion.modalidad !== "BONO") {
    return NextResponse.json({ error: "El alumno no tiene bono activo para esta clase" }, { status: 409 });
  }

  const nuevoSaldo = (inscripcion.creditosDisponibles ?? 0) + ajuste;
  if (nuevoSaldo < 0) {
    return NextResponse.json({ error: "El saldo no puede ser negativo" }, { status: 409 });
  }

  const updated = await prisma.inscripcion.update({
    where: { id: inscripcion.id },
    data: {
      creditosDisponibles: nuevoSaldo,
      // Si se añaden créditos, actualizar también los iniciales si el nuevo total supera el original
      ...(ajuste > 0 && nuevoSaldo > (inscripcion.creditosIniciales ?? 0)
        ? { creditosIniciales: nuevoSaldo }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, creditosDisponibles: updated.creditosDisponibles });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { sesionId } = await req.json();
  if (!sesionId) return NextResponse.json({ error: "Falta sesionId" }, { status: 400 });

  const sesionRealId = await resolverSesionId(sesionId);
  if (!sesionRealId) {
    return NextResponse.json({ error: "Sesión no disponible" }, { status: 404 });
  }

  const sesion = await prisma.sesion.findUnique({ where: { id: sesionRealId } });
  if (!sesion || sesion.cancelada) {
    return NextResponse.json({ error: "Sesión no disponible" }, { status: 404 });
  }

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { userId_claseId: { userId: params.id, claseId: sesion.claseId } },
    select: { id: true, activa: true, modalidad: true, creditosDisponibles: true },
  });
  if (!inscripcion || !inscripcion.activa || inscripcion.modalidad !== "BONO") {
    return NextResponse.json({ error: "El alumno no tiene bono activo para esta clase" }, { status: 409 });
  }

  const creditos = inscripcion.creditosDisponibles ?? 0;
  if (creditos <= 0) {
    return NextResponse.json({ error: "El bono no tiene créditos disponibles" }, { status: 409 });
  }

  const yaUsado = await prisma.usoBonoSesion.findUnique({
    where: { userId_sesionId: { userId: params.id, sesionId: sesion.id } },
    select: { id: true, activo: true },
  });
  if (yaUsado?.activo) {
    return NextResponse.json({ error: "El alumno ya está apuntado con bono a esta sesión" }, { status: 409 });
  }

  const ahora = new Date();
  if (inicioSesion(sesion.fecha, sesion.horaInicio) <= ahora) {
    return NextResponse.json({ error: "La sesión ya ha empezado" }, { status: 409 });
  }

  const [base, entrantes, salientes, bonosActivos] = await Promise.all([
    prisma.inscripcionHorario.count({
      where: { horarioId: sesion.horarioId, activa: true, inscripcion: { activa: true, user: { activo: true } } },
    }),
    prisma.cambio.count({
      where: { estado: { in: ["PENDIENTE", "APROBADO"] }, sesionDestinoId: sesion.id },
    }),
    prisma.cambio.count({
      where: { estado: { in: ["PENDIENTE", "APROBADO"] }, sesionOrigenId: sesion.id },
    }),
    prisma.usoBonoSesion.count({ where: { sesionId: sesion.id, activo: true, userId: { not: params.id } } }),
  ]);
  const ocupados = base + bonosActivos + entrantes - salientes;
  if (ocupados + 1 > sesion.aforo) {
    return NextResponse.json({ error: "No hay plazas disponibles en esta sesión" }, { status: 409 });
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const actual = await tx.inscripcion.findUnique({
      where: { id: inscripcion.id },
      select: { creditosDisponibles: true, activa: true, modalidad: true },
    });
    if (!actual || !actual.activa || actual.modalidad !== "BONO") {
      throw new Error("Bono no disponible");
    }
    if ((actual.creditosDisponibles ?? 0) <= 0) {
      throw new Error("Sin créditos");
    }

    await tx.inscripcion.update({
      where: { id: inscripcion.id },
      data: { creditosDisponibles: { decrement: 1 } },
    });

    const uso = await tx.usoBonoSesion.upsert({
      where: { userId_sesionId: { userId: params.id, sesionId: sesion.id } },
      update: {
        activo: true,
        inscripcionId: inscripcion.id,
        canceladoAt: null,
        canceladoPorId: null,
        creadoPorId: auth.session?.user.id,
      },
      create: {
        userId: params.id,
        inscripcionId: inscripcion.id,
        sesionId: sesion.id,
        activo: true,
        creadoPorId: auth.session?.user.id,
      },
    });

    return uso;
  });

  return NextResponse.json({ ok: true, uso: txResult }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { sesionId, devolverCredito } = await req.json();
  if (!sesionId) return NextResponse.json({ error: "Falta sesionId" }, { status: 400 });

  const sesionRealId = await resolverSesionId(sesionId);
  if (!sesionRealId) {
    return NextResponse.json({ error: "Sesión no disponible" }, { status: 404 });
  }

  const uso = await prisma.usoBonoSesion.findUnique({
    where: { userId_sesionId: { userId: params.id, sesionId: sesionRealId } },
    include: { inscripcion: true },
  });
  if (!uso || !uso.activo) {
    return NextResponse.json({ error: "No hay reserva de bono activa para esta sesión" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.usoBonoSesion.update({
      where: { id: uso.id },
      data: { activo: false, canceladoAt: new Date(), canceladoPorId: auth.session?.user.id },
    });

    if (devolverCredito) {
      await tx.inscripcion.update({
        where: { id: uso.inscripcionId },
        data: { creditosDisponibles: { increment: 1 } },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
