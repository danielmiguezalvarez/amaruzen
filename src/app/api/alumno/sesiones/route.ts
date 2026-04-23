import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import {
  calcularOcupacionSesion,
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

    const candidatos = [...mismaClaseCand, ...convenioCand];
    const aforoPorSesion = new Map(candidatos.map((s) => [s.id, s.aforo]));
    const objetivosSesion = Array.from(new Set(candidatos.map((s) => s.id)));

    const rowsOcupacion = objetivosSesion.length
      ? await prisma.$queryRaw<Array<{
        sesionId: string;
        inscritos: bigint;
        ausencias: bigint;
        cambiosEntrantes: bigint;
        cambiosSalientes: bigint;
        bonos: bigint;
      }>>(Prisma.sql`
WITH objetivo ("sesionId") AS (
  VALUES ${Prisma.join(objetivosSesion.map((id) => Prisma.sql`(${id}::text)`))}
)
SELECT
  o."sesionId",
  (
    SELECT COUNT(*)
    FROM "InscripcionHorario" ih
    JOIN "Inscripcion" i ON i."id" = ih."inscripcionId"
    JOIN "Sesion" s ON s."id" = o."sesionId"
    WHERE ih."horarioId" = s."horarioId"
      AND ih."activa" = true
      AND i."activa" = true
  ) AS "inscritos",
  (
    SELECT COUNT(*)
    FROM "Ausencia" a
    JOIN "Sesion" s ON s."id" = o."sesionId"
    WHERE a."horarioId" = s."horarioId"
      AND a."fecha" = s."fecha"
  ) AS "ausencias",
  (
    SELECT COUNT(*)
    FROM "Cambio" c
    WHERE c."estado" IN ('PENDIENTE', 'APROBADO')
      AND c."sesionDestinoId" = o."sesionId"
  ) AS "cambiosEntrantes",
  (
    SELECT COUNT(*)
    FROM "Cambio" c
    WHERE c."estado" IN ('PENDIENTE', 'APROBADO')
      AND c."sesionOrigenId" = o."sesionId"
  ) AS "cambiosSalientes",
  (
    SELECT COUNT(*)
    FROM "UsoBonoSesion" u
    JOIN "Inscripcion" ib ON ib."id" = u."inscripcionId"
    JOIN "User" uu ON uu."id" = u."userId"
    WHERE u."sesionId" = o."sesionId"
      AND u."activo" = true
      AND ib."activa" = true
      AND uu."activo" = true
  ) AS "bonos"
FROM objetivo o
`)
      : [];

    const libresPorSesion = new Map<string, number>();
    for (const r of rowsOcupacion) {
      const inscritos = Number(r.inscritos);
      const ausencias = Number(r.ausencias);
      const cambiosEntrantes = Number(r.cambiosEntrantes);
      const cambiosSalientes = Number(r.cambiosSalientes);
      const bonos = Number(r.bonos);
      const ocupados = inscritos - ausencias + cambiosEntrantes - cambiosSalientes + bonos;
      const aforo = aforoPorSesion.get(r.sesionId) ?? 0;
      libresPorSesion.set(r.sesionId, aforo - ocupados);
    }

    if (candidatos.length > 0) {
      const hayAlgunaConHueco = candidatos.some((s) => (libresPorSesion.get(s.id) ?? s.aforo) > 0);
      if (!hayAlgunaConHueco) {
        const recalculo = await Promise.all(
          candidatos.map(async (s) => {
            const occ = await calcularOcupacionSesion(s.horarioId, s.fecha, s.aforo);
            return { id: s.id, libres: occ.libres };
          })
        );
        for (const r of recalculo) libresPorSesion.set(r.id, r.libres);
      }
    }

    const mismaClase = mismaClaseCand
      .filter((s) => {
        const libres = libresPorSesion.get(s.id);
        return (libres ?? s.aforo) > 0;
      })
      .map(({ id, fecha, horaInicio, horaFin, clase, tipoConvenio }) => ({
        id,
        fecha,
        horaInicio,
        horaFin,
        clase,
        tipoConvenio,
      }));

    const convenio = convenioCand
      .filter((s) => {
        const libres = libresPorSesion.get(s.id);
        return (libres ?? s.aforo) > 0;
      })
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

    const mismaClaseUnica = Array.from(new Map(mismaClase.map((s) => [s.id, s])).values());
    const convenioUnico = Array.from(new Map(convenio.map((s) => [s.id, s])).values());

    const payload = {
      mismaClase: mismaClaseUnica
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        .slice(0, 10),
      convenio: convenioUnico
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        .slice(0, 12),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[ERROR] /api/alumno/sesiones GET", err);
    return NextResponse.json(
      { error: "Error interno al buscar sesiones disponibles" },
      { status: 500 }
    );
  }
}
