import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function inicioSesion(fecha: Date, horaInicio: string) {
  const d = new Date(fecha);
  const [h, m] = horaInicio.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const bonos = await prisma.inscripcion.findMany({
    where: {
      userId: session.user.id,
      activa: true,
      modalidad: "BONO",
    },
    include: {
      clase: { select: { id: true, nombre: true, profesor: { select: { nombre: true } } } },
      usosBono: { where: { activo: true }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    bonos.map((b) => ({
      id: b.id,
      claseId: b.claseId,
      claseNombre: b.clase.nombre,
      profesorNombre: b.clase.profesor.nombre,
      creditosIniciales: b.creditosIniciales ?? 0,
      creditosDisponibles: b.creditosDisponibles ?? 0,
      usosActivos: b.usosBono.length,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { sesionId } = await req.json();
  if (!sesionId) return NextResponse.json({ error: "Falta sesionId" }, { status: 400 });

  const sesion = await prisma.sesion.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.cancelada) {
    return NextResponse.json({ error: "Sesión no disponible" }, { status: 404 });
  }

  const inscripcion = await prisma.inscripcion.findUnique({
    where: { userId_claseId: { userId: session.user.id, claseId: sesion.claseId } },
    select: { id: true, activa: true, modalidad: true, creditosDisponibles: true },
  });
  if (!inscripcion || !inscripcion.activa || inscripcion.modalidad !== "BONO") {
    return NextResponse.json({ error: "No tienes un bono activo para esta clase" }, { status: 409 });
  }

  if ((inscripcion.creditosDisponibles ?? 0) <= 0) {
    return NextResponse.json({ error: "No te quedan créditos en el bono" }, { status: 409 });
  }

  const yaUsado = await prisma.usoBonoSesion.findUnique({
    where: { userId_sesionId: { userId: session.user.id, sesionId: sesion.id } },
    select: { id: true, activo: true },
  });
  if (yaUsado?.activo) {
    return NextResponse.json({ error: "Ya estás apuntado con bono a esta sesión" }, { status: 409 });
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
    prisma.usoBonoSesion.count({ where: { sesionId: sesion.id, activo: true, userId: { not: session.user.id } } }),
  ]);
  const ocupados = base + bonosActivos + entrantes - salientes;
  if (ocupados + 1 > sesion.aforo) {
    return NextResponse.json({ error: "No hay plazas disponibles" }, { status: 409 });
  }

  const uso = await prisma.$transaction(async (tx) => {
    const actual = await tx.inscripcion.findUnique({
      where: { id: inscripcion.id },
      select: { creditosDisponibles: true, activa: true, modalidad: true },
    });
    if (!actual || !actual.activa || actual.modalidad !== "BONO") throw new Error("BONO_INVALIDO");
    if ((actual.creditosDisponibles ?? 0) <= 0) throw new Error("SIN_CREDITOS");

    await tx.inscripcion.update({
      where: { id: inscripcion.id },
      data: { creditosDisponibles: { decrement: 1 } },
    });

    return tx.usoBonoSesion.upsert({
      where: { userId_sesionId: { userId: session.user.id, sesionId: sesion.id } },
      update: {
        activo: true,
        inscripcionId: inscripcion.id,
        canceladoAt: null,
        canceladoPorId: null,
      },
      create: {
        userId: session.user.id,
        inscripcionId: inscripcion.id,
        sesionId: sesion.id,
        activo: true,
      },
    });
  });

  return NextResponse.json({ ok: true, uso }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { sesionId } = await req.json();
  if (!sesionId) return NextResponse.json({ error: "Falta sesionId" }, { status: 400 });

  const uso = await prisma.usoBonoSesion.findUnique({
    where: { userId_sesionId: { userId: session.user.id, sesionId } },
    include: { sesion: true },
  });
  if (!uso || !uso.activo) {
    return NextResponse.json({ error: "No hay una reserva de bono activa para esta sesión" }, { status: 404 });
  }

  const ahora = new Date();
  const inicio = inicioSesion(uso.sesion.fecha, uso.sesion.horaInicio);
  const limite = new Date(inicio.getTime() - 2 * 60 * 60 * 1000);
  if (ahora >= limite) {
    return NextResponse.json(
      { error: "Solo puedes cancelar con al menos 2 horas de antelación. Si falta menos tiempo, habla con el admin." },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.usoBonoSesion.update({
      where: { id: uso.id },
      data: { activo: false, canceladoAt: new Date() },
    });
    await tx.inscripcion.update({
      where: { id: uso.inscripcionId },
      data: { creditosDisponibles: { increment: 1 } },
    });
  });

  return NextResponse.json({ ok: true });
}
