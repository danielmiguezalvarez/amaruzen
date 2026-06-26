import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cancelarSesionesEnFecha } from "@/lib/sesiones";

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if ([y, m, d].some(Number.isNaN)) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const festivos = await prisma.festivo.findMany({
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json(festivos);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { fecha, nombre } = await req.json();
  const fechaNorm = parseDate(fecha);

  if (!fechaNorm || !nombre) {
    return NextResponse.json({ error: "Falta fecha o nombre" }, { status: 400 });
  }

  const existe = await prisma.festivo.findUnique({
    where: { fecha: fechaNorm },
    select: { id: true },
  });
  if (existe) {
    return NextResponse.json({ error: "Ya existe un festivo en esa fecha" }, { status: 400 });
  }

  const festivo = await prisma.festivo.create({
    data: {
      fecha: fechaNorm,
      nombre: String(nombre),
      activo: true,
    },
  });

  const sesionesCanceladas = await cancelarSesionesEnFecha(fechaNorm);

  return NextResponse.json({ ok: true, festivo, sesionesCanceladas }, { status: 201 });
}
