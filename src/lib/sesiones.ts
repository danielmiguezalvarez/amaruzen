import { prisma } from "@/lib/prisma";
import { Prisma, type DiaSemana } from "@prisma/client";

export type SesionCalendario = {
  sesionId: string | null;
  horarioId: string;
  claseId: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  clase: {
    id: string;
    nombre: string;
    color: string | null;
    profesor: { id: string; nombre: string };
    sala: { id: string; nombre: string; color: string | null };
  };
};

export type ReservaCalendario = {
  id: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  motivo: string | null;
  sala: { id: string; nombre: string; color: string | null };
  profesional: { id: string; name: string | null; email: string };
  clase: { id: string; nombre: string } | null;
};

export type OcupacionSesion = {
  inscritos: number;
  ausencias: number;
  cambiosEntrantes: number;
  cambiosSalientes: number;
  bonos: number;
  ocupados: number;
  libres: number;
};

function toDayKey(fecha: Date): string {
  return normalizarFecha(fecha).toISOString().slice(0, 10);
}

function toKey(horarioId: string, fecha: Date): string {
  return `${horarioId}__${toDayKey(fecha)}`;
}

function toLegacyKey(claseId: string, fecha: Date): string {
  return `${claseId}__${toDayKey(fecha)}`;
}

function mismaFecha(a: Date, b: Date): boolean {
  return normalizarFecha(a).getTime() === normalizarFecha(b).getTime();
}

export function normalizarFecha(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getLunes(fecha: Date): Date {
  const d = normalizarFecha(fecha);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getDomingo(lunes: Date): Date {
  const domingo = normalizarFecha(lunes);
  domingo.setDate(domingo.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);
  return domingo;
}

export function parseSesionRef(ref: string): { horarioId: string; fecha: Date } | null {
  if (!ref.includes("__")) return null;
  const [horarioId, fechaIso] = ref.split("__");
  if (!horarioId || !fechaIso) return null;
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return null;
  return { horarioId, fecha: normalizarFecha(fecha) };
}

export async function resolverHorarioFechaDesdeRef(ref: string) {
  const parsed = parseSesionRef(ref);
  if (parsed) return parsed;

  const sesion = await prisma.sesion.findUnique({
    where: { id: ref },
    select: { horarioId: true, fecha: true },
  });
  if (!sesion) return null;

  return { horarioId: sesion.horarioId, fecha: normalizarFecha(sesion.fecha) };
}

export async function materializarSesion(horarioId: string, fecha: Date) {
  const fechaNorm = normalizarFecha(fecha);

  const existente = await prisma.sesion.findUnique({
    where: { horarioId_fecha: { horarioId, fecha: fechaNorm } },
  });
  if (existente) return { sesion: existente, creada: false };

  const horario = await prisma.horario.findUnique({
    where: { id: horarioId },
    select: {
      id: true,
      claseId: true,
      profesorId: true,
      salaId: true,
      horaInicio: true,
      horaFin: true,
      aforo: true,
      clase: { select: { activa: true, fechaInicio: true, fechaFin: true } },
    },
  });
  if (!horario || !horario.clase.activa) throw new Error("Horario no encontrado");

  if (horario.clase.fechaInicio && fechaNorm < normalizarFecha(horario.clase.fechaInicio)) {
    throw new Error("Fecha fuera del rango de la clase");
  }
  if (horario.clase.fechaFin && fechaNorm > normalizarFecha(horario.clase.fechaFin)) {
    throw new Error("Fecha fuera del rango de la clase");
  }

  const sesion = await prisma.sesion.create({
    data: {
      claseId: horario.claseId,
      horarioId,
      profesorId: horario.profesorId,
      salaId: horario.salaId,
      fecha: fechaNorm,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
      aforo: horario.aforo,
      cancelada: false,
    },
  });

  return { sesion, creada: true };
}

function dayFromDate(d: Date): DiaSemana {
  return ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][d.getDay()] as DiaSemana;
}

async function upsertSesionesEnRango(desde: Date, hasta: Date) {
  const desdeIso = normalizarFecha(desde).toISOString().slice(0, 10);
  const hastaIso = normalizarFecha(hasta).toISOString().slice(0, 10);

  return prisma.$executeRawUnsafe(`
WITH fechas AS (
  SELECT generate_series('${desdeIso}'::date, '${hastaIso}'::date, interval '1 day')::date AS fecha
),
base AS (
  SELECT
    h."id" AS "horarioId",
    h."claseId",
    h."profesorId",
    h."salaId",
    f.fecha::timestamp AS fecha,
    h."horaInicio",
    h."horaFin",
    h."aforo"
  FROM "Horario" h
  JOIN "Clase" c ON c."id" = h."claseId"
  JOIN fechas f ON h."fecha" IS NULL AND h."diaSemana" IS NOT NULL
  WHERE h."activo" = true
    AND c."activa" = true
    AND (
      (h."diaSemana" = 'LUNES' AND EXTRACT(ISODOW FROM f.fecha) = 1) OR
      (h."diaSemana" = 'MARTES' AND EXTRACT(ISODOW FROM f.fecha) = 2) OR
      (h."diaSemana" = 'MIERCOLES' AND EXTRACT(ISODOW FROM f.fecha) = 3) OR
      (h."diaSemana" = 'JUEVES' AND EXTRACT(ISODOW FROM f.fecha) = 4) OR
      (h."diaSemana" = 'VIERNES' AND EXTRACT(ISODOW FROM f.fecha) = 5) OR
      (h."diaSemana" = 'SABADO' AND EXTRACT(ISODOW FROM f.fecha) = 6) OR
      (h."diaSemana" = 'DOMINGO' AND EXTRACT(ISODOW FROM f.fecha) = 7)
    )
    AND (c."fechaInicio" IS NULL OR f.fecha >= c."fechaInicio"::date)
    AND (c."fechaFin" IS NULL OR f.fecha <= c."fechaFin"::date)

  UNION ALL

  SELECT
    h."id" AS "horarioId",
    h."claseId",
    h."profesorId",
    h."salaId",
    h."fecha"::date::timestamp AS fecha,
    h."horaInicio",
    h."horaFin",
    h."aforo"
  FROM "Horario" h
  JOIN "Clase" c ON c."id" = h."claseId"
  WHERE h."activo" = true
    AND c."activa" = true
    AND h."fecha" IS NOT NULL
    AND h."fecha"::date BETWEEN '${desdeIso}'::date AND '${hastaIso}'::date
    AND (c."fechaInicio" IS NULL OR h."fecha"::date >= c."fechaInicio"::date)
    AND (c."fechaFin" IS NULL OR h."fecha"::date <= c."fechaFin"::date)
)
INSERT INTO "Sesion" (
  "id",
  "claseId",
  "horarioId",
  "profesorId",
  "salaId",
  "fecha",
  "horaInicio",
  "horaFin",
  "aforo",
  "cancelada",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('ses_', REPLACE(gen_random_uuid()::text, '-', '')),
  b."claseId",
  b."horarioId",
  b."profesorId",
  b."salaId",
  b."fecha",
  b."horaInicio",
  b."horaFin",
  b."aforo",
  false,
  NOW(),
  NOW()
FROM base b
ON CONFLICT ("horarioId", "fecha") DO UPDATE SET
  "claseId" = EXCLUDED."claseId",
  "profesorId" = EXCLUDED."profesorId",
  "salaId" = EXCLUDED."salaId",
  "horaInicio" = EXCLUDED."horaInicio",
  "horaFin" = EXCLUDED."horaFin",
  "aforo" = EXCLUDED."aforo",
  "cancelada" = CASE WHEN "Sesion"."cancelada" = true THEN true ELSE EXCLUDED."cancelada" END,
  "updatedAt" = NOW();
`);
}

export async function calcularSesionesSemana(lunesSemana: Date) {
  const lunes = getLunes(lunesSemana);
  const domingo = getDomingo(lunes);

  await upsertSesionesEnRango(lunes, domingo);

  const [sesionesMaterializadas, reservas, salas] = await Promise.all([
    prisma.sesion.findMany({
      where: {
        fecha: { gte: lunes, lte: domingo },
        clase: { activa: true },
        horario: { activo: true },
      },
      include: {
        clase: { select: { id: true, nombre: true, color: true } },
        profesor: { select: { id: true, nombre: true } },
        sala: { select: { id: true, nombre: true, color: true } },
      },
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.reserva.findMany({
      where: { estado: "APROBADA", fecha: { gte: lunes, lte: domingo } },
      include: {
        sala: { select: { id: true, nombre: true, color: true } },
        profesional: { select: { id: true, name: true, email: true } },
        clase: { select: { id: true, nombre: true } },
      },
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.sala.findMany({
      where: { activa: true },
      select: { id: true, nombre: true, aforo: true, color: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const sesiones: SesionCalendario[] = sesionesMaterializadas.map((s) => ({
    sesionId: s.id,
    horarioId: s.horarioId,
    claseId: s.claseId,
    fecha: s.fecha,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    aforo: s.aforo,
    cancelada: s.cancelada,
    clase: {
      id: s.clase.id,
      nombre: s.clase.nombre,
      color: s.clase.color,
      profesor: { id: s.profesor.id, nombre: s.profesor.nombre },
      sala: { id: s.sala.id, nombre: s.sala.nombre, color: s.sala.color },
    },
  }));

  sesiones.sort((a, b) => {
    if (!mismaFecha(a.fecha, b.fecha)) return a.fecha.getTime() - b.fecha.getTime();
    if (a.horaInicio !== b.horaInicio) return a.horaInicio.localeCompare(b.horaInicio);
    return a.clase.sala.nombre.localeCompare(b.clase.sala.nombre);
  });

  return {
    lunes,
    domingo,
    salas,
    sesiones,
    reservas: reservas as ReservaCalendario[],
  };
}

export async function calcularOcupacionesBatch(
  objetivosInput: Array<{ horarioId: string; fecha: Date; aforo: number }>
) {
  if (objetivosInput.length === 0) return new Map<string, OcupacionSesion>();

  const objetivosUnicos = new Map<string, { horarioId: string; fecha: Date; aforo: number }>();
  for (const o of objetivosInput) {
    objetivosUnicos.set(toKey(o.horarioId, o.fecha), {
      horarioId: o.horarioId,
      fecha: normalizarFecha(o.fecha),
      aforo: o.aforo,
    });
  }
  const objetivosNorm = Array.from(objetivosUnicos.values());

  // Solo pasamos horarioId (text) y fecha (timestamp) al CTE — sin aforo para evitar
  // conflictos de tipo BigInt en el driver cuando se mezclan int y bigint en VALUES.
  const objetivos = objetivosNorm.map((o) =>
    Prisma.sql`(${o.horarioId}::text, ${normalizarFecha(o.fecha)}::timestamp)`
  );

  const rows = await prisma.$queryRaw<Array<{
    horarioId: string;
    fecha: Date;
    inscritos: bigint;
    ausencias: bigint;
    cambiosEntrantes: bigint;
    cambiosSalientes: bigint;
    bonos: bigint;
  }>>(Prisma.sql`
WITH objetivo ("horarioId", "fecha") AS (
  VALUES ${Prisma.join(objetivos)}
),
inscritos AS (
  SELECT ih."horarioId", COUNT(*)::bigint AS "inscritos"
  FROM "InscripcionHorario" ih
  JOIN "Inscripcion" i ON i."id" = ih."inscripcionId"
  JOIN objetivo o ON o."horarioId" = ih."horarioId"
  WHERE ih."activa" = true
    AND i."activa" = true
  GROUP BY ih."horarioId"
),
ausencias AS (
  SELECT a."horarioId", a."fecha", COUNT(*)::bigint AS "ausencias"
  FROM "Ausencia" a
  JOIN objetivo o ON o."horarioId" = a."horarioId" AND o."fecha" = a."fecha"
  GROUP BY a."horarioId", a."fecha"
),
cambios_entrantes AS (
  SELECT sd."horarioId", sd."fecha", COUNT(*)::bigint AS "cambiosEntrantes"
  FROM "Cambio" c
  JOIN "Sesion" sd ON sd."id" = c."sesionDestinoId"
  JOIN objetivo o ON o."horarioId" = sd."horarioId" AND o."fecha" = sd."fecha"
  WHERE c."estado" IN ('PENDIENTE', 'APROBADO')
  GROUP BY sd."horarioId", sd."fecha"
),
cambios_salientes AS (
  SELECT so."horarioId", so."fecha", COUNT(*)::bigint AS "cambiosSalientes"
  FROM "Cambio" c
  JOIN "Sesion" so ON so."id" = c."sesionOrigenId"
  JOIN objetivo o ON o."horarioId" = so."horarioId" AND o."fecha" = so."fecha"
  WHERE c."estado" IN ('PENDIENTE', 'APROBADO')
  GROUP BY so."horarioId", so."fecha"
),
bonos AS (
  SELECT sb."horarioId", sb."fecha", COUNT(*)::bigint AS "bonos"
  FROM "UsoBonoSesion" u
  JOIN "Sesion" sb ON sb."id" = u."sesionId"
  JOIN "Inscripcion" ib ON ib."id" = u."inscripcionId"
  JOIN "User" uu ON uu."id" = u."userId"
  JOIN objetivo o ON o."horarioId" = sb."horarioId" AND o."fecha" = sb."fecha"
  WHERE u."activo" = true
    AND ib."activa" = true
    AND uu."activo" = true
  GROUP BY sb."horarioId", sb."fecha"
)
SELECT
  o."horarioId",
  o."fecha",
  COALESCE(i."inscritos", 0) AS "inscritos",
  COALESCE(a."ausencias", 0) AS "ausencias",
  COALESCE(ce."cambiosEntrantes", 0) AS "cambiosEntrantes",
  COALESCE(cs."cambiosSalientes", 0) AS "cambiosSalientes",
  COALESCE(b."bonos", 0) AS "bonos"
FROM objetivo o
LEFT JOIN inscritos i
  ON i."horarioId" = o."horarioId"
LEFT JOIN ausencias a
  ON a."horarioId" = o."horarioId" AND a."fecha" = o."fecha"
LEFT JOIN cambios_entrantes ce
  ON ce."horarioId" = o."horarioId" AND ce."fecha" = o."fecha"
LEFT JOIN cambios_salientes cs
  ON cs."horarioId" = o."horarioId" AND cs."fecha" = o."fecha"
LEFT JOIN bonos b
  ON b."horarioId" = o."horarioId" AND b."fecha" = o."fecha"
`);

  // Construir mapa de aforo desde el array JS (evita pasarlo por SQL)
  const aforoPorKey = new Map<string, number>();
  for (const o of objetivosNorm) {
    aforoPorKey.set(toKey(o.horarioId, o.fecha), o.aforo);
  }

  const ocupacionPorKey = new Map<string, OcupacionSesion>();
  for (const r of rows) {
    const inscritos = Number(r.inscritos);
    const ausencias = Number(r.ausencias);
    const cambiosEntrantes = Number(r.cambiosEntrantes);
    const cambiosSalientes = Number(r.cambiosSalientes);
    const bonos = Number(r.bonos);
    const ocupados = inscritos - ausencias + cambiosEntrantes - cambiosSalientes + bonos;
    const k = toKey(r.horarioId, r.fecha);
    const aforo = aforoPorKey.get(k) ?? 0;
    ocupacionPorKey.set(k, {
      inscritos,
      ausencias,
      cambiosEntrantes,
      cambiosSalientes,
      bonos,
      ocupados,
      libres: aforo - ocupados,
    });
  }

  const result = new Map<string, OcupacionSesion>();
  for (const o of objetivosNorm) {
    const k = toKey(o.horarioId, o.fecha);
    result.set(k, ocupacionPorKey.get(k) || {
      inscritos: 0,
      ausencias: 0,
      cambiosEntrantes: 0,
      cambiosSalientes: 0,
      bonos: 0,
      ocupados: 0,
      libres: o.aforo,
    });
  }

  return result;
}

export async function calcularOcupacionesSemanaBatch(sesiones: SesionCalendario[]) {
  return calcularOcupacionesBatch(
    sesiones.map((s) => ({
      horarioId: s.horarioId,
      fecha: s.fecha,
      aforo: s.aforo,
    }))
  );
}

export async function calcularOcupacionSesion(horarioId: string, fecha: Date, aforo: number) {
  const [base, ausencias, cambiosEntrantes, cambiosSalientes, bonos] = await Promise.all([
    prisma.inscripcionHorario.count({
      where: { horarioId, activa: true, inscripcion: { activa: true } },
    }),
    prisma.ausencia.count({
      where: { horarioId, fecha: normalizarFecha(fecha) },
    }),
    prisma.cambio.count({
      where: {
        estado: { in: ["PENDIENTE", "APROBADO"] },
        sesionDestino: { horarioId, fecha: normalizarFecha(fecha) },
      },
    }),
    prisma.cambio.count({
      where: {
        estado: { in: ["PENDIENTE", "APROBADO"] },
        sesionOrigen: { horarioId, fecha: normalizarFecha(fecha) },
      },
    }),
    prisma.usoBonoSesion.count({
      where: {
        activo: true,
        sesion: { horarioId, fecha: normalizarFecha(fecha) },
        inscripcion: { activa: true },
        user: { activo: true },
      },
    }),
  ]);

  const ocupados = base - ausencias + cambiosEntrantes - cambiosSalientes + bonos;
  return {
    inscritos: base,
    ausencias,
    cambiosEntrantes,
    cambiosSalientes,
    bonos,
    ocupados,
    libres: aforo - ocupados,
  };
}

export async function resolverHorarioId(refOrId: string): Promise<string | null> {
  const parsed = parseSesionRef(refOrId);
  if (parsed) return parsed.horarioId;

  const sesion = await prisma.sesion.findUnique({ where: { id: refOrId }, select: { horarioId: true } });
  if (sesion) return sesion.horarioId;

  const horario = await prisma.horario.findUnique({ where: { id: refOrId }, select: { id: true } });
  return horario?.id ?? null;
}

export async function resolverSesionId(refOrId: string): Promise<string | null> {
  const parsed = parseSesionRef(refOrId);
  if (!parsed) {
    const sesion = await prisma.sesion.findUnique({ where: { id: refOrId }, select: { id: true } });
    return sesion?.id ?? null;
  }

  const { sesion } = await materializarSesion(parsed.horarioId, parsed.fecha);
  return sesion.id;
}

export async function generarSesionesPorRango(desde: Date, hasta: Date) {
  return upsertSesionesEnRango(desde, hasta);
}

export async function generarSesionesSemana(lunes: Date) {
  return generarSesionesPorRango(getLunes(lunes), getDomingo(getLunes(lunes)));
}

export function keySesion(horarioId: string, fecha: Date) {
  return toKey(horarioId, fecha);
}

export function keySesionLegacy(claseId: string, fecha: Date) {
  return toLegacyKey(claseId, fecha);
}

export function diaSemanaDesdeFecha(fecha: Date): DiaSemana {
  return dayFromDate(fecha);
}
