import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const clases = await prisma.clase.findMany({
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
  return NextResponse.json(clases);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, tipoNombre, tipoClaseId, profesorId, salaId, aforo, recurrente, diaSemana, horaInicio, horaFin, fechaFin, color } = await req.json();

  if (!nombre || !profesorId || !salaId || !aforo || !horaInicio || !horaFin) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
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
      recurrente: Boolean(recurrente),
      diaSemana: recurrente ? diaSemana : null,
      horaInicio,
      horaFin,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      color: color || null,
    },
    include: { profesor: true, sala: true, tipoClase: true },
  });

  return NextResponse.json(clase, { status: 201 });
}
