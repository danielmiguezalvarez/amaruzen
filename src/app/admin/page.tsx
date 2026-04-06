import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const [
    totalAlumnos,
    totalClases,
    cambiosPendientes,
    sesionesHoy,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "ALUMNO", activo: true } }),
    prisma.clase.count({ where: { activa: true } }),
    prisma.cambio.count({ where: { estado: "PENDIENTE" } }),
    prisma.sesion.findMany({
      where: { fecha: { gte: hoy, lt: manana }, cancelada: false },
      include: { clase: { include: { profesor: true, sala: true } } },
      orderBy: { horaInicio: "asc" },
    }),
  ]);

  const ultimosCambiosPendientes = await prisma.cambio.findMany({
    where: { estado: "PENDIENTE" },
    include: {
      user: true,
      sesionOrigen: { include: { clase: true } },
      sesionDestino: { include: { clase: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Panel de gestión</h1>
        <p className="text-stone-400 text-sm mt-1">
          {hoy.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Alumnos activos", value: totalAlumnos, href: "/admin/alumnos" },
          { label: "Clases activas", value: totalClases, href: "/admin/clases" },
          { label: "Cambios pendientes", value: cambiosPendientes, href: "/admin/cambios", alert: cambiosPendientes > 0 },
          { label: "Sesiones hoy", value: sesionesHoy.length, href: "/admin/sesiones" },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-xl border p-4 transition-colors hover:border-stone-400 ${
              card.alert
                ? "bg-amber-50 border-amber-300"
                : "bg-white border-stone-200"
            }`}
          >
            <p className={`text-sm ${card.alert ? "text-amber-700" : "text-stone-500"}`}>{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.alert ? "text-amber-800" : "text-stone-800"}`}>
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sesiones de hoy */}
        <div className="bg-white rounded-xl border border-stone-200">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800">Sesiones de hoy</h2>
            <Link href="/admin/sesiones" className="text-sm text-stone-500 hover:text-stone-800">Ver todas</Link>
          </div>
          {sesionesHoy.length === 0 ? (
            <p className="px-5 py-8 text-center text-stone-400 text-sm">No hay sesiones programadas hoy</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {sesionesHoy.map((sesion: typeof sesionesHoy[number]) => (
                <li key={sesion.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-stone-800 text-sm">{sesion.clase.nombre}</p>
                    <p className="text-xs text-stone-500">{sesion.clase.profesor.nombre} · {sesion.clase.sala.nombre}</p>
                  </div>
                  <p className="text-sm text-stone-600">{sesion.horaInicio} - {sesion.horaFin}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cambios pendientes */}
        <div className="bg-white rounded-xl border border-stone-200">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800">Cambios pendientes</h2>
            <Link href="/admin/cambios" className="text-sm text-stone-500 hover:text-stone-800">Ver todos</Link>
          </div>
          {ultimosCambiosPendientes.length === 0 ? (
            <p className="px-5 py-8 text-center text-stone-400 text-sm">No hay cambios pendientes</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {ultimosCambiosPendientes.map((cambio: typeof ultimosCambiosPendientes[number]) => (
                <li key={cambio.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-stone-800">{cambio.user.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {cambio.sesionOrigen.clase.nombre} → {cambio.sesionDestino.clase.nombre}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
