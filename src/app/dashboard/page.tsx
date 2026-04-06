import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  const hoy = new Date();
  const inicioSemana = new Date(hoy);
  inicioSemana.setHours(0, 0, 0, 0);
  const finSemana = new Date(hoy);
  finSemana.setDate(finSemana.getDate() + 7);
  finSemana.setHours(23, 59, 59, 999);

  // Mis clases inscritas
  const inscripciones = await prisma.inscripcion.findMany({
    where: { userId: session.user.id, activa: true },
    include: {
      clase: {
        include: { profesor: true, sala: true },
      },
    },
  });

  // Cambios pendientes
  const cambiosPendientes = await prisma.cambio.findMany({
    where: { userId: session.user.id, estado: "PENDIENTE" },
    include: {
      sesionOrigen: { include: { clase: true } },
      sesionDestino: { include: { clase: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Próximas sesiones esta semana
  const proximasSesiones = await prisma.sesion.findMany({
    where: {
      fecha: { gte: hoy, lte: finSemana },
      cancelada: false,
      clase: {
        inscripciones: { some: { userId: session.user.id, activa: true } },
      },
    },
    include: { clase: { include: { profesor: true, sala: true } } },
    orderBy: { fecha: "asc" },
    take: 5,
  });


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">
          Hola, {session.user.name?.split(" ")[0] || "alumno"}
        </h1>
        <p className="text-stone-500 text-sm mt-1">Aquí tienes tu resumen de esta semana</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Clases inscritas</p>
          <p className="text-3xl font-bold text-stone-800 mt-1">{inscripciones.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Esta semana</p>
          <p className="text-3xl font-bold text-stone-800 mt-1">{proximasSesiones.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Cambios pendientes</p>
          <p className="text-3xl font-bold text-stone-800 mt-1">{cambiosPendientes.length}</p>
        </div>
      </div>

      {/* Próximas sesiones */}
      <div className="bg-white rounded-xl border border-stone-200">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800">Próximas clases</h2>
          <Link href="/dashboard/clases" className="text-sm text-stone-500 hover:text-stone-800">
            Ver todas
          </Link>
        </div>
        {proximasSesiones.length === 0 ? (
          <p className="px-5 py-8 text-center text-stone-400 text-sm">
            No tienes clases programadas esta semana
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {proximasSesiones.map((sesion: typeof proximasSesiones[number]) => (
              <li key={sesion.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-800 text-sm">{sesion.clase.nombre}</p>
                  <p className="text-xs text-stone-500">
                    {sesion.clase.profesor.nombre} · {sesion.clase.sala.nombre}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-stone-700">
                    {sesion.fecha.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="text-xs text-stone-500">{sesion.horaInicio} - {sesion.horaFin}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cambios pendientes */}
      {cambiosPendientes.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200">
          <div className="px-5 py-4 border-b border-amber-200">
            <h2 className="font-semibold text-amber-800">Cambios pendientes de aprobación</h2>
          </div>
          <ul className="divide-y divide-amber-100">
            {cambiosPendientes.map((cambio: typeof cambiosPendientes[number]) => (
              <li key={cambio.id} className="px-5 py-3">
                <p className="text-sm text-amber-900">
                  <span className="font-medium">{cambio.sesionOrigen.clase.nombre}</span>
                  {" → "}
                  <span className="font-medium">{cambio.sesionDestino.clase.nombre}</span>
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Solicitado el {cambio.createdAt.toLocaleDateString("es-ES")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
