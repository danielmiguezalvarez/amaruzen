import { prisma } from "@/lib/prisma";

const DIA_A_JS: Record<string, number> = {
  DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6,
};

/**
 * Genera sesiones para todas las clases recurrentes activas
 * dentro del rango [desde, hasta] (inclusive).
 * Respeta la fechaFin de cada clase.
 * Es idempotente: no crea duplicados gracias al unique [claseId, fecha].
 */
export async function generarSesionesPorRango(desde: Date, hasta: Date) {
  const clases = await prisma.clase.findMany({
    where: { activa: true, recurrente: true, diaSemana: { not: null } },
  });

  let creadas = 0;

  for (const clase of clases) {
    const diaObjetivo = DIA_A_JS[clase.diaSemana!];

    // Límite efectivo: el menor entre `hasta` y `fechaFin` de la clase
    const limiteClase = clase.fechaFin && clase.fechaFin < hasta ? clase.fechaFin : hasta;

    // Primer día del rango que coincida con el día de la semana
    const cursor = new Date(desde);
    cursor.setHours(0, 0, 0, 0);
    const diaCursor = cursor.getDay();
    const diff = (diaObjetivo - diaCursor + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    while (cursor <= limiteClase) {
      try {
        await prisma.sesion.create({
          data: {
            claseId: clase.id,
            fecha: new Date(cursor),
            horaInicio: clase.horaInicio,
            horaFin: clase.horaFin,
            aforo: clase.aforo,
          },
        });
        creadas++;
      } catch (e: unknown) {
        // Solo ignorar violaciones de unique constraint (sesión ya existe)
        if ((e as { code?: string })?.code !== "P2002") throw e;
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return creadas;
}

/**
 * Genera sesiones para una semana concreta (lunes al domingo).
 * Usado al cargar la vista semanal.
 */
export async function generarSesionesSemana(lunes: Date) {
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);
  return generarSesionesPorRango(lunes, domingo);
}

/**
 * Devuelve el lunes de la semana a la que pertenece una fecha dada.
 */
export function getLunes(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const dia = d.getDay(); // 0=dom, 1=lun...
  const diff = (dia === 0 ? -6 : 1 - dia);
  d.setDate(d.getDate() + diff);
  return d;
}
