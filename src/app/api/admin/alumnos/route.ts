import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const alumnos = await prisma.user.findMany({
    where: { role: "ALUMNO" },
    select: {
      id: true,
      name: true,
      email: true,
      activo: true,
      password: true,
      inscripciones: {
        where: { activa: true },
        include: {
          clase: { include: { profesor: true } },
          horarios: {
            where: { activa: true },
            include: {
              horario: {
                include: {
                  sala: true,
                  profesor: true,
                },
              },
            },
          },
          usosBono: {
            where: { activo: true },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    alumnos.map(({ password, ...a }) => ({
      ...a,
      accesoActivo: Boolean(password),
    }))
  );
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, email, password } = await req.json();
  if (!nombre || !email) {
    return NextResponse.json({ error: "Nombre y email son obligatorios" }, { status: 400 });
  }

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });

  const hashedPassword = password ? await bcrypt.hash(password, 12) : null;

  const alumno = await prisma.user.create({
    data: { name: nombre, email, password: hashedPassword, role: "ALUMNO" },
  });
  return NextResponse.json(alumno, { status: 201 });
}
