import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { nombre, email, telefono, activo, password } = await req.json();
  const emailNorm = typeof email === "string" ? email.trim().toLowerCase() : undefined;
  const emailFinal = emailNorm === undefined ? undefined : (emailNorm || null);
  const actual = await prisma.profesor.findUnique({
    where: { id: params.id },
    include: { user: true },
  });
  if (!actual) {
    return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
  }
  const data: {
    nombre?: string;
    email?: string | null;
    telefono?: string | null;
    activo?: boolean;
  } = {};

  if (typeof nombre === "string") data.nombre = nombre;
  if (emailFinal !== undefined) data.email = emailFinal;
  if (telefono !== undefined) data.telefono = telefono || null;
  if (typeof activo === "boolean") data.activo = activo;

  let userId = actual.userId;
  if (emailFinal) {
    const userByEmail = await prisma.user.findUnique({ where: { email: emailFinal } });
    if (userByEmail && userByEmail.role !== "PROFESIONAL") {
      return NextResponse.json({ error: "Ya existe un usuario con ese email y otro rol" }, { status: 409 });
    }

    if (userByEmail) {
      userId = userByEmail.id;
      const updateData: { name?: string | null; role?: "PROFESIONAL"; activo?: boolean; password?: string | null } = {
        role: "PROFESIONAL",
      };
      if (nombre !== undefined) updateData.name = nombre;
      if (typeof activo === "boolean") updateData.activo = activo;
      if (password) updateData.password = await bcrypt.hash(password, 12);
      await prisma.user.update({ where: { id: userByEmail.id }, data: updateData });
    } else {
      const user = await prisma.user.create({
        data: {
          name: nombre || actual.nombre,
          email: emailFinal,
          role: "PROFESIONAL",
          activo: typeof activo === "boolean" ? activo : true,
          password: password ? await bcrypt.hash(password, 12) : null,
        },
      });
      userId = user.id;
    }
  }

  const profesor = await prisma.profesor.update({
    where: { id: params.id },
    data: { ...data, userId },
    include: { user: { select: { id: true, activo: true } } },
  });
  return NextResponse.json(profesor);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const clasesActivas = await prisma.clase.findMany({
    where: { profesorId: params.id, activa: true },
    select: { nombre: true },
    orderBy: { nombre: "asc" },
  });

  if (clasesActivas.length > 0) {
    return NextResponse.json(
      {
        error: "No se puede desactivar: el profesor tiene clases activas",
        clases: clasesActivas.map((c) => c.nombre),
      },
      { status: 409 }
    );
  }

  await prisma.profesor.update({ where: { id: params.id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
