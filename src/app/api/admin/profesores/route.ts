import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const profesores = await prisma.profesor.findMany({
    include: { user: { select: { id: true, password: true, activo: true } } },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(
    profesores.map(({ user, ...p }) => ({
      ...p,
      user: user ? { id: user.id, activo: user.activo } : null,
      accesoActivo: Boolean(user?.password),
    }))
  );
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, email, telefono, password } = await req.json();
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  let userId: string | null = null;
  if (email) {
    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe && existe.role !== "PROFESIONAL") {
      return NextResponse.json({ error: "Ya existe un usuario con ese email y otro rol" }, { status: 409 });
    }
    if (existe) {
      userId = existe.id;
      if (password) {
        const hashed = await bcrypt.hash(password, 12);
        await prisma.user.update({ where: { id: existe.id }, data: { password: hashed, role: "PROFESIONAL", activo: true } });
      }
    } else {
      const hashed = password ? await bcrypt.hash(password, 12) : null;
      const user = await prisma.user.create({
        data: {
          name: nombre,
          email,
          password: hashed,
          role: "PROFESIONAL",
          activo: true,
        },
      });
      userId = user.id;
    }
  }

  const profesor = await prisma.profesor.create({
    data: { nombre, email, telefono, userId: userId || undefined },
  });
  return NextResponse.json(profesor, { status: 201 });
}
