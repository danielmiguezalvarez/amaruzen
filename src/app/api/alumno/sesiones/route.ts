import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  calcularOcupacionesBatch,
  getLunes,
  getDomingo,
  generarSesionesPorRango,
  normalizarFecha,
  resolverSesionId,
} from "@/lib/sesiones";

function getInicioSesion(fecha: Date, horaInicio: string) {
  const inicio = new Date(fecha);
  const [h, m] = horaInicio.split(":").map(Number);
  inicio.setHours(h, m, 0, 0);
  return inicio;
}

function occKey(horarioId: string, fecha: Date) {
  return `${horarioId}__${normalizarFecha(fecha).toISOString().slice(0, 10)}`;
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
    const desde = normalizarFecha(ahora);

    const lunesBase = getLunes(ahora);
    const hasta = getDomingo(new Date(lunesBase.getFullYear(), lunesBase.getMonth(), lunesBase.getDate() + 7 * 12));
    await generarSesionesPorRango(lunesBase, hasta);

    // ── Misma clase, otros horarios ──────────────────────────────────────────

    const horariosMismaClase = await prisma.horario.findMany({
      where: { claseId: sesionOrigen.claseId, activo: true },
      include: { clase: true, profesor: true, sala: true },
    });

    const mismaClaseCand: Array<{
      id: string;
      horarioId: string;
      fecha: Date;
      aforo: number;
      horaInicio: string;
      horaFin: string;
      clase: { nombre: string; profesor: { nombre: string }; sala: { nombre: string } };
      tipoConvenio: null;
    }> = [];

    const horariosAlternos = horariosMismaClase.filter((h) => h.id !== sesionOrigen.horarioId);
    const metaHorarioMisma = new Map(horariosAlternos.map((h) => [h.id, h]));
    if (horariosAlternos.length > 0) {
      const sesionesMismaClase = await prisma.sesion.findMany({
        where: {
          horarioId: { in: horariosAlternos.map((h) => h.id) },
          fecha: { gte: desde, lte: hasta },
          cancelada: false,
        },
        select: {
          id: true,
          horarioId: true,
          fecha: true,
          horaInicio: true,
          horaFin: true,
          aforo: true,
        },
      });

      for (const sesion of sesionesMismaClase) {
        const inicio = getInicioSesion(sesion.fecha, sesion.horaInicio);
        if (inicio <= ahora) continue;
        const horario = metaHorarioMisma.get(sesion.horarioId);
        if (!horario) continue;
        mismaClaseCand.push({
          id: sesion.id,
          horarioId: sesion.horarioId,
          fecha: sesion.fecha,
          aforo: sesion.aforo,
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

    const convenioCand: Array<{
      id: string;
      horarioId: string;
      fecha: Date;
      aforo: number;
      horaInicio: string;
      horaFin: string;
      clase: { nombre: string; profesor: { nombre: string }; sala: { nombre: string } };
      tipoConvenio: "EQUIVALENTE" | "EXCEPCIONAL";
      convenioId: string;
      requiereAprobacion: boolean;
    }> = [];

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const countsConvenio = convenios.length
      ? await prisma.cambio.groupBy({
        by: ["convenioId"],
        where: {
          userId: session.user.id,
          convenioId: { in: convenios.map((c) => c.id) },
          estado: { in: ["PENDIENTE", "APROBADO"] },
          createdAt: { gte: inicioMes },
        },
        _count: { convenioId: true },
      })
      : [];
    const countPorConvenio = new Map(countsConvenio.map((r) => [r.convenioId, r._count.convenioId]));

    const conveniosActivos = convenios
      .map((c) => ({
        ...c,
        claseDestinoId: c.claseAId === sesionOrigen.claseId ? c.claseBId : c.claseAId,
      }))
      .filter((c) => (countPorConvenio.get(c.id) ?? 0) < c.limiteMensual);

    const clasesDestinoIds = Array.from(new Set(conveniosActivos.map((c) => c.claseDestinoId)));
    const horariosDestino = clasesDestinoIds.length
      ? await prisma.horario.findMany({
        where: { claseId: { in: clasesDestinoIds }, activo: true, clase: { activa: true } },
        include: { clase: true, profesor: true, sala: true },
      })
      : [];

    const conveniosPorClaseDestino = new Map<string, typeof conveniosActivos>();
    for (const c of conveniosActivos) {
      const list = conveniosPorClaseDestino.get(c.claseDestinoId) ?? [];
      list.push(c);
      conveniosPorClaseDestino.set(c.claseDestinoId, list);
    }

    const metaHorarioDestino = new Map(horariosDestino.map((h) => [h.id, h]));
    if (horariosDestino.length > 0) {
      const sesionesDestino = await prisma.sesion.findMany({
        where: {
          horarioId: { in: horariosDestino.map((h) => h.id) },
          fecha: { gte: desde, lte: hasta },
          cancelada: false,
        },
        select: {
          id: true,
          horarioId: true,
          fecha: true,
          horaInicio: true,
          horaFin: true,
          aforo: true,
        },
      });

      for (const sesion of sesionesDestino) {
        const inicio = getInicioSesion(sesion.fecha, sesion.horaInicio);
        if (inicio <= ahora) continue;
        const horario = metaHorarioDestino.get(sesion.horarioId);
        if (!horario) continue;
        const conveniosClase = conveniosPorClaseDestino.get(horario.claseId) ?? [];
        for (const c of conveniosClase) {
          convenioCand.push({
            id: sesion.id,
            horarioId: sesion.horarioId,
            fecha: sesion.fecha,
            aforo: sesion.aforo,
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

    const ocupacion = await calcularOcupacionesBatch([
      ...mismaClaseCand.map((s) => ({ horarioId: s.horarioId, fecha: s.fecha, aforo: s.aforo })),
      ...convenioCand.map((s) => ({ horarioId: s.horarioId, fecha: s.fecha, aforo: s.aforo })),
    ]);

    const mismaClase = mismaClaseCand
      .filter((s) => (ocupacion.get(occKey(s.horarioId, s.fecha))?.libres ?? 0) > 0)
      .map(({ id, fecha, horaInicio, horaFin, clase, tipoConvenio }) => ({
        id,
        fecha,
        horaInicio,
        horaFin,
        clase,
        tipoConvenio,
      }));

    const convenio = convenioCand
      .filter((s) => (ocupacion.get(occKey(s.horarioId, s.fecha))?.libres ?? 0) > 0)
      .map(({ id, fecha, horaInicio, horaFin, clase, tipoConvenio, convenioId, requiereAprobacion }) => ({
        id,
        fecha,
        horaInicio,
        horaFin,
        clase,
        tipoConvenio,
        convenioId,
        requiereAprobacion,
      }));

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
