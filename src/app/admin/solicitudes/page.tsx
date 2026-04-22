"use client";

import { useEffect, useState } from "react";

type Solicitud = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  tipo: string;
  mensaje: string | null;
  leida: boolean;
  createdAt: string;
};

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const res = await fetch("/api/admin/solicitudes");
    if (res.ok) setSolicitudes(await res.json());
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  async function marcarLeida(id: string) {
    await fetch("/api/admin/solicitudes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSolicitudes((prev) => prev.map((s) => s.id === id ? { ...s, leida: true } : s));
  }

  const pendientes = solicitudes.filter((s) => !s.leida);
  const leidas = solicitudes.filter((s) => s.leida);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Solicitudes de alta</h1>
        <p className="text-stone-500 text-sm mt-1">
          {pendientes.length > 0
            ? `${pendientes.length} solicitud${pendientes.length > 1 ? "es" : ""} sin leer`
            : "Sin solicitudes pendientes"}
        </p>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Cargando...</p>
      ) : solicitudes.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-5 py-10 text-center text-stone-400 text-sm">
          No hay solicitudes de alta
        </div>
      ) : (
        <div className="space-y-4">
          {pendientes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Sin leer</h2>
              {pendientes.map((s) => (
                <SolicitudCard key={s.id} solicitud={s} onMarcarLeida={marcarLeida} />
              ))}
            </div>
          )}
          {leidas.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wide">Procesadas</h2>
              {leidas.map((s) => (
                <SolicitudCard key={s.id} solicitud={s} onMarcarLeida={marcarLeida} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SolicitudCard({
  solicitud: s,
  onMarcarLeida,
}: {
  solicitud: Solicitud;
  onMarcarLeida: (id: string) => void;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        s.leida ? "border-stone-200 opacity-70" : "border-amber-300 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-800 text-sm">{s.nombre}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                s.tipo === "ALUMNO"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {s.tipo === "ALUMNO" ? "Alumno" : "Profesional"}
            </span>
            {!s.leida && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Nueva
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">{s.email}</p>
          {s.telefono && <p className="text-xs text-stone-500">Tel: {s.telefono}</p>}
          {s.mensaje && (
            <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{s.mensaje}</p>
          )}
          <p className="text-xs text-stone-400 mt-1">
            {new Date(s.createdAt).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {!s.leida && (
          <button
            onClick={() => onMarcarLeida(s.id)}
            className="shrink-0 px-3 py-1.5 text-xs border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-600"
          >
            Marcar procesada
          </button>
        )}
      </div>
    </div>
  );
}
