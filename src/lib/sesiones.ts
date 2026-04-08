import { prisma } from "@/lib/prisma";
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

type OcupacionSesion = {
  inscritos: number;
  ausencias: number;
  cambiosEntrantes: number;
  cambiosSalientes: number;
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

  const excepcion = await prisma.sesionExcepcion.findUnique({
    where: { horarioId_fecha: { horarioId, fecha: fechaNorm } },
  });

  const horaInicio = excepcion?.tipo === "REUBICADA" && excepcion.horaInicio
    ? excepcion.horaInicio
    : horario.horaInicio;
  const horaFin = excepcion?.tipo === "REUBICADA" && excepcion.horaFin
    ? excepcion.horaFin
    : horario.horaFin;

  const sesion = await prisma.sesion.create({
    data: {
      claseId: horario.claseId,
      horarioId,
      fecha: fechaNorm,
      horaInicio,
      horaFin,
      aforo: horario.aforo,
      cancelada: excepcion?.tipo === "CANCELADA",
    },
  });

  return { sesion, creada: true };
}

function dayFromDate(d: Date): DiaSemana {
  return ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][d.getDay()] as DiaSemana;
}

export async function calcularSesionesSemana(lunesSemana: Date) {
  const lunes = getLunes(lunesSemana);
  const domingo = getDomingo(lunes);

  const [horarios, excepciones, sesionesMaterializadas, reservas, salas] = await Promise.all([
    prisma.horario.findMany({
      where: {
        activo: true,
        clase: { activa: true },
        OR: [
          { fecha: { not: null, gte: lunes, lte: domingo } },
          { fecha: null, diaSemana: { not: null } },
        ],
      },
      include: {
        clase: { select: { id: true, nombre: true, color: true, fechaInicio: true, fechaFin: true, activa: true } },
        profesor: { select: { id: true, nombre: true } },
        sala: { select: { id: true, nombre: true, color: true } },
      },
    }),
    prisma.sesionExcepcion.findMany({
      where: { fecha: { gte: lunes, lte: domingo } },
    }),
    prisma.sesion.findMany({
      where: { fecha: { gte: lunes, lte: domingo } },
      select: {
        id: true,
        horarioId: true,
        fecha: true,
        horaInicio: true,
        horaFin: true,
        aforo: true,
        cancelada: true,
      },
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

  const excepcionesPorKey = new Map(excepciones.map((e) => [toKey(e.horarioId, e.fecha), e]));
  const materializadasPorKey = new Map(sesionesMaterializadas.map((s) => [toKey(s.horarioId, s.fecha), s]));

  const sesiones: SesionCalendario[] = [];

  for (const horario of horarios) {
    let sesionFecha: Date | null = null;

    if (horario.fecha) {
      sesionFecha = normalizarFecha(horario.fecha);
    } else if (horario.diaSemana) {
      const diaObjetivo = DIA_A_JS[horario.diaSemana];
      const d = normalizarFecha(lunes);
      d.setDate(d.getDate() + ((diaObjetivo === 0 ? 7 : diaObjetivo) - 1));
      sesionFecha = d;
    }

    if (!sesionFecha) continue;
    if (sesionFecha < lunes || sesionFecha > domingo) continue;
    if (horario.clase.fechaInicio && sesionFecha < normalizarFecha(horario.clase.fechaInicio)) continue;
    if (horario.clase.fechaFin && sesionFecha > normalizarFecha(horario.clase.fechaFin)) continue;

    const key = toKey(horario.id, sesionFecha);
    const excepcion = excepcionesPorKey.get(key);
    const materializada = materializadasPorKey.get(key);

    const horaInicio = excepcion?.tipo === "REUBICADA" && excepcion.horaInicio
      ? excepcion.horaInicio
      : materializada?.horaInicio || horario.horaInicio;
    const horaFin = excepcion?.tipo === "REUBICADA" && excepcion.horaFin
      ? excepcion.horaFin
      : materializada?.horaFin || horario.horaFin;

    sesiones.push({
      sesionId: materializada?.id || null,
      horarioId: horario.id,
      claseId: horario.clase.id,
      fecha: sesionFecha,
      horaInicio,
      horaFin,
      aforo: materializada?.aforo ?? horario.aforo,
      cancelada: Boolean(excepcion?.tipo === "CANCELADA" || materializada?.cancelada),
      clase: {
        id: horario.clase.id,
        nombre: horario.clase.nombre,
        color: horario.clase.color,
        profesor: { id: horario.profesor.id, nombre: horario.profesor.nombre },
        sala: { id: horario.sala.id, nombre: horario.sala.nombre, color: horario.sala.color },
      },
    });
  }

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

export async function calcularOcupacionesSemanaBatch(sesiones: SesionCalendario[]) {
  if (sesiones.length === 0) return new Map<string, OcupacionSesion>();

  const horarioIds = Array.from(new Set(sesiones.map((s) => s.horarioId)));
  const keys = new Set(sesiones.map((s) => toKey(s.horarioId, s.fecha)));
  const fechas = Array.from(new Set(sesiones.map((s) => normalizarFecha(s.fecha).toISOString()))).map((iso) => new Date(iso));

  const [baseInscripciones, ausencias, cambiosEntrantes, cambiosSalientes] = await Promise.all([
    prisma.inscripcionHorario.groupBy({
      by: ["horarioId"],
      where: {
        horarioId: { in: horarioIds },
        activa: true,
        inscripcion: { activa: true },
      },
      _count: { _all: true },
    }),
    prisma.ausencia.findMany({
      where: {
        horarioId: { in: horarioIds },
        fecha: { in: fechas },
      },
      select: { horarioId: true, fecha: true },
    }),
    prisma.cambio.findMany({
      where: {
        estado: { in: ["PENDIENTE", "APROBADO"] },
        sesionDestino: { horarioId: { in: horarioIds }, fecha: { in: fechas } },
      },
      select: { sesionDestino: { select: { horarioId: true, fecha: true } } },
    }),
    prisma.cambio.findMany({
      where: {
        estado: { in: ["PENDIENTE", "APROBADO"] },
        sesionOrigen: { horarioId: { in: horarioIds }, fecha: { in: fechas } },
      },
      select: { sesionOrigen: { select: { horarioId: true, fecha: true } } },
    }),
  ]);

  const basePorHorario = new Map(baseInscripciones.map((x) => [x.horarioId, x._count._all]));
  const ausenciasPorKey = new Map<string, number>();
  const entrantesPorKey = new Map<string, number>();
  const salientesPorKey = new Map<string, number>();

  for (const a of ausencias) {
    const k = toKey(a.horarioId, a.fecha);
    if (!keys.has(k)) continue;
    ausenciasPorKey.set(k, (ausenciasPorKey.get(k) || 0) + 1);
  }
  for (const c of cambiosEntrantes) {
    const k = toKey(c.sesionDestino.horarioId, c.sesionDestino.fecha);
    if (!keys.has(k)) continue;
    entrantesPorKey.set(k, (entrantesPorKey.get(k) || 0) + 1);
  }
  for (const c of cambiosSalientes) {
    const k = toKey(c.sesionOrigen.horarioId, c.sesionOrigen.fecha);
    if (!keys.has(k)) continue;
    salientesPorKey.set(k, (salientesPorKey.get(k) || 0) + 1);
  }

  const result = new Map<string, OcupacionSesion>();
  for (const s of sesiones) {
    const k = toKey(s.horarioId, s.fecha);
    const inscritos = basePorHorario.get(s.horarioId) || 0;
    const ausenciasCount = ausenciasPorKey.get(k) || 0;
    const cambiosEntrantesCount = entrantesPorKey.get(k) || 0;
    const cambiosSalientesCount = salientesPorKey.get(k) || 0;
    const ocupados = inscritos - ausenciasCount + cambiosEntrantesCount - cambiosSalientesCount;
    result.set(k, {
      inscritos,
      ausencias: ausenciasCount,
      cambiosEntrantes: cambiosEntrantesCount,
      cambiosSalientes: cambiosSalientesCount,
      ocupados,
      libres: s.aforo - ocupados,
    });
  }

  return result;
}

export async function calcularOcupacionSesion(horarioId: string, fecha: Date, aforo: number) {
  const [base, ausencias, cambiosEntrantes, cambiosSalientes] = await Promise.all([
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
  ]);

  const ocupados = base - ausencias + cambiosEntrantes - cambiosSalientes;
  return {
    inscritos: base,
    ausencias,
    cambiosEntrantes,
    cambiosSalientes,
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
  const desdeNorm = normalizarFecha(desde);
  const hastaNorm = normalizarFecha(hasta);

  const horarios = await prisma.horario.findMany({
    where: {
      activo: true,
      clase: { activa: true },
      OR: [
        { fecha: { gte: desdeNorm, lte: hastaNorm } },
        { fecha: null, diaSemana: { not: null } },
      ],
    },
    include: { clase: true },
  });

  let creadas = 0;
  for (const horario of horarios) {
    if (horario.fecha) {
      const f = normalizarFecha(horario.fecha);
      if (f < desdeNorm || f > hastaNorm) continue;
      const { creada } = await materializarSesion(horario.id, f);
      if (creada) creadas++;
      continue;
    }

    if (!horario.diaSemana) continue;
    const diaObjetivo = DIA_A_JS[horario.diaSemana];
    const cursor = new Date(desdeNorm);
    const diff = (diaObjetivo - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    while (cursor <= hastaNorm) {
      if (horario.clase.fechaInicio && cursor < normalizarFecha(horario.clase.fechaInicio)) {
        cursor.setDate(cursor.getDate() + 7);
        continue;
      }
      if (horario.clase.fechaFin && cursor > normalizarFecha(horario.clase.fechaFin)) break;

      const { creada } = await materializarSesion(horario.id, cursor);
      if (creada) creadas++;
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return creadas;
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
