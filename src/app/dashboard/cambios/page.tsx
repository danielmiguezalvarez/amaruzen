import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  APROBADO: "bg-green-100 text-green-700",
  RECHAZADO: "bg-red-100 text-red-600",
};

const ESTADO_ES: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export default async function MisCambiosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  const cambios = await prisma.cambio.findMany({
    where: { userId: session.user.id },
    include: {
      sesionOrigen: { include: { clase: { include: { profesor: true } } } },
      sesionDestino: { include: { clase: { include: { profesor: true } } } },
      convenio: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Mis cambios</h1>
        <p className="text-stone-500 text-sm mt-1">Historial de cambios de sesión</p>
      </div>

      {cambios.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-5 py-12 text-center text-stone-400 text-sm">
          No has realizado ningún cambio todavía
        </div>
      ) : (
        <div className="space-y-3">
          {cambios.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[c.estado]}`}>
                      {ESTADO_ES[c.estado]}
                    </span>
                    {c.convenio && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.convenio.tipo === "EXCEPCIONAL" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                        {c.convenio.tipo === "EXCEPCIONAL" ? "Excepcional" : "Equivalente"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-stone-700">
                    <span className="font-medium">{c.sesionOrigen.clase.nombre}</span>
                    <span className="text-stone-400 mx-2">→</span>
                    <span className="font-medium">{c.sesionDestino.clase.nombre}</span>
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    {new Date(c.sesionOrigen.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} {c.sesionOrigen.horaInicio}
                    {" → "}
                    {new Date(c.sesionDestino.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} {c.sesionDestino.horaInicio}
                    {" · "}
                    Solicitado el {new Date(c.createdAt).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
