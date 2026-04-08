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

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const withFormData = searchParams.get("withFormData") === "1";

  const clasesPromise = prisma.clase.findMany({
    include: {
      profesor: true,
      sala: true,
      tipoClase: true,
      horarios: {
        where: { activo: true },
        include: { profesor: true, sala: true },
        orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
      },
    },
    orderBy: { nombre: "asc" },
  });

  if (!withFormData) {
    return NextResponse.json(await clasesPromise);
  }

  const [clases, profesores, salas] = await Promise.all([
    clasesPromise,
    prisma.profesor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.sala.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return NextResponse.json({ clases, profesores, salas });
}

export async function POST(req: Request) {
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
    color,
    horarios,
  } = await req.json();

  if (!nombre || !profesorId || !salaId || !aforo) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const horariosEntrada: HorarioPayload[] =
    Array.isArray(horarios) && horarios.length > 0
      ? horarios
      : [];

  if (horariosEntrada.length === 0) {
    return NextResponse.json({ error: "Debes añadir al menos un horario" }, { status: 400 });
  }

  for (const h of horariosEntrada) {
    if (!h.diaSemana || !h.horaInicio || !h.horaFin || !h.profesorId || !h.salaId) {
      return NextResponse.json({ error: "Horario inválido: faltan campos" }, { status: 400 });
    }
    if (!horaValida(h.horaInicio) || !horaValida(h.horaFin) || h.horaInicio >= h.horaFin) {
      return NextResponse.json({ error: "Horario inválido: horas incorrectas" }, { status: 400 });
    }
  }

  // Resolver el tipoClaseId: usar el pasado directamente, o crear uno nuevo desde tipoNombre, o usar el nombre de la clase como fallback
  let tipoId = tipoClaseId;
  if (!tipoId) {
    const tipo = await prisma.tipoClase.create({
      data: { nombre: tipoNombre || nombre },
    });
    tipoId = tipo.id;
  }

  const clase = await prisma.clase.create({
    data: {
      nombre,
      tipoClaseId: tipoId,
      profesorId,
      salaId,
      aforo: Number(aforo),
      recurrente: true,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      color: color || null,
    },
    include: { profesor: true, sala: true, tipoClase: true },
  });

  await prisma.horario.createMany({
    data: horariosEntrada.map((h) => ({
      claseId: clase.id,
      profesorId: h.profesorId,
      salaId: h.salaId,
      diaSemana: h.diaSemana,
      fecha: null,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      aforo: Number(aforo),
      activo: true,
    })),
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hasta = new Date(hoy);
  hasta.setDate(hasta.getDate() + 84);
  await generarSesionesPorRango(hoy, hasta);

  return NextResponse.json(clase, { status: 201 });
}
