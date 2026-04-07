import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { calcularOcupacionSesion, materializarSesion, normalizarFecha } from "@/lib/sesiones";

function parseSesionRef(ref: string): { claseId: string; fecha: Date } | null {
  if (!ref.includes("__")) return null;
  const [claseId, fechaIso] = ref.split("__");
  if (!claseId || !fechaIso) return null;
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return null;
  return { claseId, fecha: normalizarFecha(fecha) };
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const sesionRef = searchParams.get("sesionRef");
  if (!sesionRef) {
    return NextResponse.json({ error: "Falta sesionRef" }, { status: 400 });
  }

  let sesionId = sesionRef;
  const parsed = parseSesionRef(sesionRef);
  if (parsed) {
    const { sesion } = await materializarSesion(parsed.claseId, parsed.fecha);
    sesionId = sesion.id;
  }

  const sesion = await prisma.sesion.findUnique({
    where: { id: sesionId },
    include: {
      clase: {
        include: {
          profesor: true,
          sala: true,
          inscripciones: { where: { activa: true }, include: { user: true } },
        },
      },
    },
  });

  if (!sesion) {
    return NextResponse.json({ error: "Sesion no encontrada" }, { status: 404 });
  }

  const ocupacion = await calcularOcupacionSesion(sesion.claseId, sesion.fecha, sesion.aforo);

  return NextResponse.json({
    sesion,
    ocupacion,
    alumnos: sesion.clase.inscripciones.map((i) => ({
      id: i.user.id,
      name: i.user.name,
      email: i.user.email,
    })),
  });
}
