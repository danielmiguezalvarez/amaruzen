import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

function overlap(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  return toMinutes(aInicio) < toMinutes(bFin) && toMinutes(bInicio) < toMinutes(aFin);
}

// POST body: { claseId, numClases, horarioIds: string[] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId, numClases, horarioIds } = await req.json();
  if (!claseId || !Array.isArray(horarioIds) || horarioIds.length === 0) {
    return NextResponse.json({ error: "Faltan datos de inscripción" }, { status: 400 });
  }

  const alumno = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, activo: true, role: true },
  });
  if (!alumno || alumno.role !== "ALUMNO") {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }
  if (!alumno.activo) {
    return NextResponse.json({ error: "No se puede inscribir un alumno de baja" }, { status: 409 });
  }

  const numClasesNum = Number(numClases) || horarioIds.length;
  if (horarioIds.length > numClasesNum) {
    return NextResponse.json(
      { error: "No puedes asignar más horarios que clases contratadas" },
      { status: 409 }
    );
  }

  const horarios = await prisma.horario.findMany({
    where: { id: { in: horarioIds }, claseId, activo: true },
    include: { clase: true },
  });
  if (horarios.length !== horarioIds.length) {
    return NextResponse.json({ error: "Algún horario no existe o no pertenece a la clase" }, { status: 404 });
  }

  for (const h of horarios) {
    const ocupados = await prisma.inscripcionHorario.count({
      where: {
        horarioId: h.id,
        activa: true,
        inscripcion: {
          activa: true,
          user: { activo: true },
          userId: { not: params.id },
        },
      },
    });
    const aforoMax = h.aforo || h.clase.aforo;
    if (ocupados + 1 > aforoMax) {
      const etiqueta = h.fecha
        ? `${h.fecha.toISOString().slice(0, 10)} ${h.horaInicio}-${h.horaFin}`
        : `${h.diaSemana || ""} ${h.horaInicio}-${h.horaFin}`;
      return NextResponse.json(
        { error: `Aforo completo en el horario ${etiqueta}` },
        { status: 409 }
      );
    }
  }

  const seleccionadosPorDia = new Map<string, Array<{ inicio: string; fin: string }>>();
  for (const h of horarios) {
    const dia = h.fecha ? h.fecha.toISOString().slice(0, 10) : (h.diaSemana || "");
    const list = seleccionadosPorDia.get(dia) || [];
    const conflict = list.some((x) => overlap(h.horaInicio, h.horaFin, x.inicio, x.fin));
    if (conflict) {
      return NextResponse.json({ error: "Hay horarios solapados en la selección" }, { status: 409 });
    }
    list.push({ inicio: h.horaInicio, fin: h.horaFin });
    seleccionadosPorDia.set(dia, list);
  }

  const inscripcion = await prisma.inscripcion.upsert({
    where: { userId_claseId: { userId: params.id, claseId } },
    update: {
      activa: true,
      numClases: numClasesNum,
    },
    create: {
      userId: params.id,
      claseId,
      activa: true,
      numClases: numClasesNum,
    },
  });

  await prisma.inscripcionHorario.updateMany({
    where: { inscripcionId: inscripcion.id },
    data: { activa: false },
  });

  for (const horarioId of horarioIds as string[]) {
    await prisma.inscripcionHorario.upsert({
      where: {
        inscripcionId_horarioId: {
          inscripcionId: inscripcion.id,
          horarioId,
        },
      },
      update: { activa: true },
      create: {
        inscripcionId: inscripcion.id,
        horarioId,
        activa: true,
      },
    });
  }

  return NextResponse.json({ ok: true, inscripcion }, { status: 201 });
}

// DELETE body: { claseId }
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { claseId } = await req.json();
  if (!claseId) {
    return NextResponse.json({ error: "Falta claseId" }, { status: 400 });
  }

  const inscripciones = await prisma.inscripcion.findMany({
    where: { userId: params.id, claseId },
    select: { id: true },
  });

  await prisma.inscripcion.updateMany({
    where: { userId: params.id, claseId },
    data: { activa: false },
  });

  await prisma.inscripcionHorario.updateMany({
    where: { inscripcionId: { in: inscripciones.map((i) => i.id) } },
    data: { activa: false },
  });

  return NextResponse.json({ ok: true });
}
