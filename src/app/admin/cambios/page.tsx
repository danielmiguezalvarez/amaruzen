"use client";

import { useEffect, useState } from "react";

type Cambio = {
  id: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  createdAt: string;
  user: { name: string | null; email: string };
  sesionOrigen: { fecha: string; horaInicio: string; clase: { nombre: string; profesor: { nombre: string } } };
  sesionDestino: { fecha: string; horaInicio: string; clase: { nombre: string; profesor: { nombre: string } } };
  convenio: { tipo: "EQUIVALENTE" | "EXCEPCIONAL" } | null;
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  APROBADO: "bg-green-100 text-green-700",
  RECHAZADO: "bg-red-100 text-red-600",
};

export default function CambiosPage() {
  const [cambios, setCambios] = useState<Cambio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"TODOS" | "PENDIENTE" | "APROBADO" | "RECHAZADO">("PENDIENTE");

  async function cargar() {
    const data = await fetch("/api/admin/cambios").then((r) => r.json());
    setCambios(data);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  const cambiosFiltrados = filtro === "TODOS" ? cambios : cambios.filter((c) => c.estado === filtro);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Cambios de sesión</h1>
        <p className="text-stone-500 text-sm mt-1">Gestión de solicitudes de cambio de los alumnos</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["PENDIENTE", "APROBADO", "RECHAZADO", "TODOS"] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtro === f ? "bg-stone-800 text-white" : "bg-white border border-stone-300 text-stone-600 hover:bg-stone-50"}`}>
            {f === "TODOS" ? "Todos" : f === "PENDIENTE" ? "Pendientes" : f === "APROBADO" ? "Aprobados" : "Rechazados"}
            {f !== "TODOS" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({cambios.filter((c) => c.estado === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <p className="text-stone-400 text-sm">Cargando...</p> : (
        <div className="space-y-3">
          {cambiosFiltrados.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 px-5 py-10 text-center text-stone-400 text-sm">
              No hay cambios {filtro !== "TODOS" ? filtro.toLowerCase() + "s" : ""}
            </div>
          ) : (
            cambiosFiltrados.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-stone-800">{c.user.name || c.user.email}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[c.estado]}`}>
                        {c.estado === "PENDIENTE" ? "Pendiente" : c.estado === "APROBADO" ? "Aprobado" : "Rechazado"}
                      </span>
                      {c.convenio && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.convenio.tipo === "EXCEPCIONAL" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                          {c.convenio.tipo === "EXCEPCIONAL" ? "Excepcional" : "Equivalente"}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-stone-600">
                      <span className="font-medium">{c.sesionOrigen.clase.nombre}</span>
                      <span className="text-stone-400 mx-2">→</span>
                      <span className="font-medium">{c.sesionDestino.clase.nombre}</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Desde: {new Date(c.sesionOrigen.fecha).toLocaleDateString("es-ES")} {c.sesionOrigen.horaInicio} ·
                      Hasta: {new Date(c.sesionDestino.fecha).toLocaleDateString("es-ES")} {c.sesionDestino.horaInicio} ·
                      Solicitado: {new Date(c.createdAt).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                   <div className="text-xs text-stone-400 shrink-0">
                     #{c.id.slice(0, 8)}
                   </div>
                 </div>
               </div>
             ))
          )}
        </div>
      )}
    </div>
  );
}
