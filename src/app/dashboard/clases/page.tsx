import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClasesClient from "./clases-client";

export default async function MisClasesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  const inscripciones = await prisma.inscripcion.findMany({
    where: { userId: session.user.id, activa: true },
    include: {
      clase: {
        include: { profesor: true, sala: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Para cada clase, buscar las próximas 2 sesiones
  const claseConSesiones = await Promise.all(
    inscripciones.map(async (insc) => {
      const sesiones = await prisma.sesion.findMany({
        where: {
          claseId: insc.clase.id,
          fecha: { gte: new Date() },
          cancelada: false,
        },
        orderBy: { fecha: "asc" },
        take: 2,
      });
      return { ...insc, sesiones };
    })
  );

  return <ClasesClient inscripciones={claseConSesiones} />;
}
