import { prisma } from "@/lib/prisma";

const DIA_A_JS: Record<string, number> = {
  DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6,
};

export type SesionCalendario = {
  sesionId: string | null;
  claseId: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  clase: {
    id: string;
    nombre: string;
    profesor: { id: string; nombre: string };
    sala: { id: string; nombre: string };
  };
};

export type ReservaCalendario = {
  id: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  motivo: string | null;
  sala: { id: string; nombre: string };
  profesional: { id: string; name: string | null; email: string };
};

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

function toKey(claseId: string, fecha: Date): string {
  return `${claseId}__${normalizarFecha(fecha).toISOString().slice(0, 10)}`;
}

function mismaFecha(a: Date, b: Date): boolean {
  return normalizarFecha(a).getTime() === normalizarFecha(b).getTime();
}

export async function materializarSesion(claseId: string, fecha: Date) {
  const fechaNorm = normalizarFecha(fecha);

  const existente = await prisma.sesion.findUnique({
    where: { claseId_fecha: { claseId, fecha: fechaNorm } },
  });

  if (existente) return { sesion: existente, creada: false };

  const clase = await prisma.clase.findUnique({ where: { id: claseId } });
  if (!clase) throw new Error("Clase no encontrada");

  const excepcion = await prisma.sesionExcepcion.findUnique({
    where: { claseId_fecha: { claseId, fecha: fechaNorm } },
  });

  const horaInicio = excepcion?.tipo === "REUBICADA" && excepcion.horaInicio
    ? excepcion.horaInicio
    : clase.horaInicio;
  const horaFin = excepcion?.tipo === "REUBICADA" && excepcion.horaFin
    ? excepcion.horaFin
    : clase.horaFin;

  const sesion = await prisma.sesion.create({
    data: {
      claseId,
      fecha: fechaNorm,
      horaInicio,
      horaFin,
      aforo: clase.aforo,
      cancelada: excepcion?.tipo === "CANCELADA",
    },
  });

  return { sesion, creada: true };
}

export async function calcularOcupacionSesion(claseId: string, fecha: Date, aforo: number) {
  const fechaNorm = normalizarFecha(fecha);

  const inscritos = await prisma.inscripcion.count({
    where: { claseId, activa: true },
  });

  const cambiosEntrantes = await prisma.cambio.count({
    where: {
      estado: { in: ["PENDIENTE", "APROBADO"] },
      sesionDestino: { claseId, fecha: fechaNorm },
    },
  });

  const cambiosSalientes = await prisma.cambio.count({
    where: {
      estado: { in: ["PENDIENTE", "APROBADO"] },
      sesionOrigen: { claseId, fecha: fechaNorm },
    },
  });

  const ocupados = inscritos + cambiosEntrantes - cambiosSalientes;

  return {
    inscritos,
    cambiosEntrantes,
    cambiosSalientes,
    ocupados,
    libres: aforo - ocupados,
  };
}

export async function calcularSesionesSemana(lunesSemana: Date) {
  const lunes = getLunes(lunesSemana);
  const domingo = getDomingo(lunes);

  const [clases, excepciones, sesionesMaterializadas, reservas, salas] = await Promise.all([
    prisma.clase.findMany({
      where: { activa: true, recurrente: true, diaSemana: { not: null } },
      include: { profesor: true, sala: true },
    }),
    prisma.sesionExcepcion.findMany({
      where: { fecha: { gte: lunes, lte: domingo } },
    }),
    prisma.sesion.findMany({
      where: { fecha: { gte: lunes, lte: domingo } },
      include: { clase: { include: { profesor: true, sala: true } } },
    }),
    prisma.reserva.findMany({
      where: { estado: "APROBADA", fecha: { gte: lunes, lte: domingo } },
      include: {
        sala: { select: { id: true, nombre: true } },
        profesional: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.sala.findMany({
      where: { activa: true },
      select: { id: true, nombre: true, aforo: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const excepcionesPorKey = new Map(excepciones.map((e) => [toKey(e.claseId, e.fecha), e]));
  const materializadasPorKey = new Map(sesionesMaterializadas.map((s) => [toKey(s.claseId, s.fecha), s]));

  const sesiones: SesionCalendario[] = [];

  for (const clase of clases) {
    const diaObjetivo = DIA_A_JS[clase.diaSemana!];
    const sesionFecha = normalizarFecha(lunes);
    sesionFecha.setDate(sesionFecha.getDate() + ((diaObjetivo === 0 ? 7 : diaObjetivo) - 1));

    if (clase.fechaInicio && sesionFecha < normalizarFecha(clase.fechaInicio)) continue;
    if (clase.fechaFin && sesionFecha > normalizarFecha(clase.fechaFin)) continue;

    const key = toKey(clase.id, sesionFecha);
    const excepcion = excepcionesPorKey.get(key);
    const materializada = materializadasPorKey.get(key);

    const horaInicio = excepcion?.tipo === "REUBICADA" && excepcion.horaInicio
      ? excepcion.horaInicio
      : materializada?.horaInicio || clase.horaInicio;
    const horaFin = excepcion?.tipo === "REUBICADA" && excepcion.horaFin
      ? excepcion.horaFin
      : materializada?.horaFin || clase.horaFin;

    sesiones.push({
      sesionId: materializada?.id || null,
      claseId: clase.id,
      fecha: sesionFecha,
      horaInicio,
      horaFin,
      aforo: materializada?.aforo ?? clase.aforo,
      cancelada: Boolean(excepcion?.tipo === "CANCELADA" || materializada?.cancelada),
      clase: {
        id: clase.id,
        nombre: clase.nombre,
        profesor: { id: clase.profesor.id, nombre: clase.profesor.nombre },
        sala: { id: clase.sala.id, nombre: clase.sala.nombre },
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

// Compatibilidad temporal con endpoints antiguos; se eliminará al migrar la API semanal.
export async function generarSesionesPorRango(desde: Date, hasta: Date) {
  const clases = await prisma.clase.findMany({
    where: { activa: true, recurrente: true, diaSemana: { not: null } },
  });

  const desdeNorm = normalizarFecha(desde);
  const hastaNorm = normalizarFecha(hasta);

  let creadas = 0;

  for (const clase of clases) {
    const diaObjetivo = DIA_A_JS[clase.diaSemana!];
    const cursor = new Date(desdeNorm);
    const diff = (diaObjetivo - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    while (cursor <= hastaNorm) {
      if (clase.fechaInicio && cursor < normalizarFecha(clase.fechaInicio)) {
        cursor.setDate(cursor.getDate() + 7);
        continue;
      }
      if (clase.fechaFin && cursor > normalizarFecha(clase.fechaFin)) break;

      const { creada } = await materializarSesion(clase.id, cursor);
      if (creada) creadas++;
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return creadas;
}

export async function generarSesionesSemana(lunes: Date) {
  return generarSesionesPorRango(getLunes(lunes), getDomingo(getLunes(lunes)));
}
