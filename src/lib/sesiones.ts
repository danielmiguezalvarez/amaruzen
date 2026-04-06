import { prisma } from "@/lib/prisma";

const DIA_A_JS: Record<string, number> = {
  DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6,
};

/**
 * Genera sesiones para todas las clases recurrentes activas
 * hasta el horizonte indicado (por defecto 2 meses vista).
 * Es idempotente: no crea duplicados gracias al unique [claseId, fecha].
 */
export async function generarSesiones(mesesVista = 2) {
  const clases = await prisma.clase.findMany({
    where: { activa: true, recurrente: true, diaSemana: { not: null } },
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const horizonte = new Date(hoy);
  horizonte.setMonth(horizonte.getMonth() + mesesVista);

  let creadas = 0;

  for (const clase of clases) {
    const diaObjetivo = DIA_A_JS[clase.diaSemana!];

    // Calcular el primer día desde hoy que coincida con el día de la semana
    const cursor = new Date(hoy);
    const diaCursor = cursor.getDay();
    const diff = (diaObjetivo - diaCursor + 7) % 7;
    cursor.setDate(cursor.getDate() + diff);

    while (cursor <= horizonte) {
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
      } catch (e: any) {
        // Only swallow unique constraint violations (session already exists)
        if (e?.code !== "P2002") throw e;
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return creadas;
}
