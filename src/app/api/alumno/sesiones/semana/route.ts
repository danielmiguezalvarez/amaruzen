import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calcularSesionesSemana, getLunes } from "@/lib/sesiones";

// GET /api/alumno/sesiones/semana?fecha=YYYY-MM-DD
// Devuelve sesiones del centro, marcando cuáles son del alumno
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fechaParam = searchParams.get("fecha");

    const base = fechaParam ? new Date(fechaParam) : new Date();
    if (Number.isNaN(base.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const lunes = getLunes(base);
    const { domingo, salas, sesiones, reservas } = await calcularSesionesSemana(lunes);

    const inscripciones = await prisma.inscripcionHorario.findMany({
      where: {
        activa: true,
        inscripcion: { userId: session.user.id, activa: true },
      },
      select: { horarioId: true },
    });
    const horariosPropios = new Set(inscripciones.map((i) => i.horarioId));

    const usosBono = await prisma.usoBonoSesion.findMany({
      where: {
        userId: session.user.id,
        activo: true,
        sesion: {
          fecha: { gte: lunes, lte: domingo },
        },
      },
      select: { sesionId: true },
    });
    const sesionesBono = new Set(usosBono.map((u) => u.sesionId));

    // Traemos TODOS los cambios aprobados del usuario sin filtrar por semana.
    // Así detectamos tanto origen como destino aunque estén en semanas distintas.
    const cambiosAprobados = await prisma.cambio.findMany({
      where: {
        userId: session.user.id,
        estado: "APROBADO",
      },
      select: { sesionOrigenId: true, sesionDestinoId: true },
    });
    const sesionesCambioOrigen = new Set(
      cambiosAprobados.map((c) => c.sesionOrigenId).filter(Boolean) as string[]
    );
    const sesionesCambioDestino = new Set(
      cambiosAprobados.map((c) => c.sesionDestinoId).filter(Boolean) as string[]
    );

    const sesionesConFlag = sesiones.map((s) => ({
      cambioEntrante: s.sesionId ? sesionesCambioDestino.has(s.sesionId) : false,
      cambioSaliente: s.sesionId ? sesionesCambioOrigen.has(s.sesionId) : false,
      id: s.sesionId || `${s.horarioId}__${s.fecha.toISOString().slice(0, 10)}`,
      sesionId: s.sesionId,
      horarioId: s.horarioId,
      claseId: s.claseId,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      aforo: s.aforo,
      cancelada: s.cancelada,
      esInscrito:
        ((horariosPropios.has(s.horarioId) || (s.sesionId ? sesionesCambioDestino.has(s.sesionId) : false))
          && !(s.sesionId ? sesionesCambioOrigen.has(s.sesionId) : false))
        || (s.sesionId ? sesionesBono.has(s.sesionId) : false),
      esBono: s.sesionId ? sesionesBono.has(s.sesionId) : false,
      clase: s.clase,
    }));

    // DEBUG TEMPORAL — eliminar tras confirmar
    const debug = sesionesConFlag
      .filter((s) => s.esInscrito || s.cambioEntrante || s.cambioSaliente)
      .map((s) => ({
        id: s.id,
        sesionId: s.sesionId,
        clase: s.clase.nombre,
        fecha: new Date(s.fecha).toISOString().slice(0, 10),
        hora: s.horaInicio,
        esInscrito: s.esInscrito,
        cambioEntrante: s.cambioEntrante,
        cambioSaliente: s.cambioSaliente,
      }));
    console.log("[semana debug]", JSON.stringify({ userId: session.user.id, lunes: lunes.toISOString().slice(0,10), debug }));

    return NextResponse.json({
      lunes: lunes.toISOString(),
      domingo: domingo.toISOString(),
      salas,
      sesiones: sesionesConFlag,
      reservas,
      _debug: debug,
    });
  } catch (err) {
    console.error("[ERROR] /api/alumno/sesiones/semana", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
