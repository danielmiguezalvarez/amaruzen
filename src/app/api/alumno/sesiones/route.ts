import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  calcularOcupacionSesion,
  materializarSesion,
  normalizarFecha,
  resolverSesionId,
} from "@/lib/sesiones";
import type { DiaSemana } from "@prisma/client";

const DIA_A_JS: Record<DiaSemana, number> = {
  DOMINGO: 0,
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
};

function getInicioSesion(fecha: Date, horaInicio: string) {
  const inicio = new Date(fecha);
  const [h, m] = horaInicio.split(":").map(Number);
  inicio.setHours(h, m, 0, 0);
  return inicio;
}

function siguientesFechasHorario(
  diaSemana: DiaSemana | null,
  fechaPuntual: Date | null,
  desde: Date,
  limite: number,
  fechaInicio?: Date | null,
  fechaFin?: Date | null
) {
  if (fechaPuntual) {
    const f = normalizarFecha(fechaPuntual);
    if (f >= normalizarFecha(desde)) return [f];
    return [];
  }

  if (!diaSemana) return [];

  const objetivo = DIA_A_JS[diaSemana];
  const cursor = normalizarFecha(desde);
  const diff = (objetivo - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + diff);

  const fechas: Date[] = [];
  while (fechas.length < limite) {
    if (fechaFin && cursor > normalizarFecha(fechaFin)) break;
    if (!fechaInicio || cursor >= normalizarFecha(fechaInicio)) {
      fechas.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return fechas;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sesionOrigenId = searchParams.get("sesionOrigenId");
    if (!sesionOrigenId) return NextResponse.json({ error: "Falta sesionOrigenId" }, { status: 400 });

    const sesionOrigenRealId = await resolverSesionId(sesionOrigenId);
    if (!sesionOrigenRealId) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    const sesionOrigen = await prisma.sesion.findUnique({
      where: { id: sesionOrigenRealId },
      include: { clase: true, horario: true },
    });
    if (!sesionOrigen) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

    const ahora = new Date();

    // ── Misma clase, otros horarios ──────────────────────────────────────────

    const horariosMismaClase = await prisma.horario.findMany({
      where: { claseId: sesionOrigen.claseId, activo: true },
      include: { clase: true, profesor: true, sala: true },
    });

    const mismaClase: Array<{
      id: string;
      fecha: Date;
      horaInicio: string;
      horaFin: string;
      clase: { nombre: string; profesor: { nombre: string }; sala: { nombre: string } };
      tipoConvenio: null;
    }> = [];

    for (const horario of horariosMismaClase) {
      // Excluir el mismo horario origen — solo queremos horarios distintos
      if (horario.id === sesionOrigen.horarioId) continue;

      const fechas = siguientesFechasHorario(
        horario.diaSemana,
        horario.fecha,
        normalizarFecha(ahora),
        12,
        horario.clase.fechaInicio,
        horario.clase.fechaFin
      );

      for (const fecha of fechas) {
        let sesion;
        try {
          ({ sesion } = await materializarSesion(horario.id, fecha));
        } catch {
          continue;
        }

        const inicio = getInicioSesion(sesion.fecha, sesion.horaInicio);
        if (inicio <= ahora || sesion.cancelada) continue;

        const ocupacion = await calcularOcupacionSesion(horario.id, sesion.fecha, sesion.aforo);
        if (ocupacion.libres <= 0) continue;

        mismaClase.push({
          id: sesion.id,
          fecha: sesion.fecha,
          horaInicio: sesion.horaInicio,
          horaFin: sesion.horaFin,
          clase: {
            nombre: horario.clase.nombre,
            profesor: { nombre: horario.profesor.nombre },
            sala: { nombre: horario.sala.nombre },
          },
          tipoConvenio: null,
        });
      }
    }

    // ── Convenios ────────────────────────────────────────────────────────────

    const convenios = await prisma.convenio.findMany({
      where: {
        activo: true,
        OR: [{ claseAId: sesionOrigen.claseId }, { claseBId: sesionOrigen.claseId }],
      },
    });

    const convenio: Array<{
      id: string;
      fecha: Date;
      horaInicio: string;
      horaFin: string;
      clase: { nombre: string; profesor: { nombre: string }; sala: { nombre: string } };
      tipoConvenio: "EQUIVALENTE" | "EXCEPCIONAL";
      convenioId: string;
      requiereAprobacion: boolean;
    }> = [];

    for (const c of convenios) {
      const claseDestinoId = c.claseAId === sesionOrigen.claseId ? c.claseBId : c.claseAId;

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const cambiosEsteMes = await prisma.cambio.count({
        where: {
          userId: session.user.id,
          convenioId: c.id,
          estado: { in: ["PENDIENTE", "APROBADO"] },
          createdAt: { gte: inicioMes },
        },
      });
      if (cambiosEsteMes >= c.limiteMensual) continue;

      const horariosDestino = await prisma.horario.findMany({
        where: { claseId: claseDestinoId, activo: true, clase: { activa: true } },
        include: { clase: true, profesor: true, sala: true },
        take: 20,
      });

      for (const horario of horariosDestino) {
        const fechas = siguientesFechasHorario(
          horario.diaSemana,
          horario.fecha,
          normalizarFecha(ahora),
          8,
          horario.clase.fechaInicio,
          horario.clase.fechaFin
        );

        for (const fecha of fechas) {
          let sesion;
          try {
            ({ sesion } = await materializarSesion(horario.id, fecha));
          } catch {
            continue;
          }

          const inicio = getInicioSesion(sesion.fecha, sesion.horaInicio);
          if (inicio <= ahora || sesion.cancelada) continue;

          const ocupacion = await calcularOcupacionSesion(horario.id, sesion.fecha, sesion.aforo);
          if (ocupacion.libres <= 0) continue;

          convenio.push({
            id: sesion.id,
            fecha: sesion.fecha,
            horaInicio: sesion.horaInicio,
            horaFin: sesion.horaFin,
            clase: {
              nombre: horario.clase.nombre,
              profesor: { nombre: horario.profesor.nombre },
              sala: { nombre: horario.sala.nombre },
            },
            tipoConvenio: c.tipo,
            convenioId: c.id,
            requiereAprobacion: c.requiereAprobacion,
          });
        }
      }
    }

    return NextResponse.json({
      mismaClase: mismaClase
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        .slice(0, 10),
      convenio: convenio
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        .slice(0, 12),
    });
  } catch (err) {
    console.error("[ERROR] /api/alumno/sesiones GET", err);
    return NextResponse.json(
      { error: "Error interno al buscar sesiones disponibles" },
      { status: 500 }
    );
  }
}
