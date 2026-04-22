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
  estado: string; // "PENDIENTE" | "ACEPTADA" | "DESCARTADA"
  usuarioId: string | null;
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

  function actualizar(id: string, cambios: Partial<Solicitud>) {
    setSolicitudes((prev) => prev.map((s) => s.id === id ? { ...s, ...cambios } : s));
  }

  const pendientes = solicitudes.filter((s) => s.estado === "PENDIENTE");
  const procesadas = solicitudes.filter((s) => s.estado !== "PENDIENTE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Solicitudes de alta</h1>
        <p className="text-stone-500 text-sm mt-1">
          {pendientes.length > 0
            ? `${pendientes.length} solicitud${pendientes.length > 1 ? "es" : ""} pendiente${pendientes.length > 1 ? "s" : ""}`
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
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                Pendientes ({pendientes.length})
              </h2>
              {pendientes.map((s) => (
                <SolicitudCard key={s.id} solicitud={s} onActualizar={actualizar} defaultOpen />
              ))}
            </div>
          )}
          {procesadas.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                Procesadas ({procesadas.length})
              </h2>
              {procesadas.map((s) => (
                <SolicitudCard key={s.id} solicitud={s} onActualizar={actualizar} defaultOpen={false} />
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
  onActualizar,
  defaultOpen,
}: {
  solicitud: Solicitud;
  onActualizar: (id: string, cambios: Partial<Solicitud>) => void;
  defaultOpen: boolean;
}) {
  const [abierta, setAbierta] = useState(defaultOpen);
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const esPendiente = s.estado === "PENDIENTE";

  async function aceptar() {
    if (!confirm(`¿Aceptar la solicitud de ${s.nombre}? Se creará el alumno y se enviará la invitación de acceso por email.`)) return;
    setProcesando(true);
    setErrorMsg("");
    const res = await fetch(`/api/admin/solicitudes/${s.id}/aceptar`, { method: "POST" });
    const data = await res.json();
    setProcesando(false);
    if (!res.ok) {
      setErrorMsg(data.error || "No se pudo aceptar la solicitud");
      return;
    }
    onActualizar(s.id, { estado: "ACEPTADA", leida: true, usuarioId: data.alumnoId });
  }

  async function descartar() {
    if (!confirm(`¿Descartar la solicitud de ${s.nombre}? No se creará ningún alumno.`)) return;
    setProcesando(true);
    setErrorMsg("");
    const res = await fetch(`/api/admin/solicitudes/${s.id}/descartar`, { method: "POST" });
    const data = await res.json();
    setProcesando(false);
    if (!res.ok) {
      setErrorMsg(data.error || "No se pudo descartar la solicitud");
      return;
    }
    onActualizar(s.id, { estado: "DESCARTADA", leida: true });
  }

  const estadoBadge = {
    PENDIENTE: { texto: "Pendiente", clase: "bg-amber-100 text-amber-700" },
    ACEPTADA:  { texto: "Aceptada",  clase: "bg-emerald-100 text-emerald-700" },
    DESCARTADA:{ texto: "Descartada",clase: "bg-stone-100 text-stone-500" },
  }[s.estado] ?? { texto: s.estado, clase: "bg-stone-100 text-stone-500" };

  return (
    <div
      className={`bg-white rounded-xl border transition-shadow ${
        esPendiente ? "border-amber-300 shadow-sm" : "border-stone-200"
      }`}
    >
      {/* Cabecera clicable */}
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-stone-800 text-sm">{s.nombre}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              s.tipo === "ALUMNO" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
            }`}
          >
            {s.tipo === "ALUMNO" ? "Alumno" : "Profesional"}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge.clase}`}>
            {estadoBadge.texto}
          </span>
          <span className="text-xs text-stone-400">
            {new Date(s.createdAt).toLocaleDateString("es-ES", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
        </div>
        <span className="text-stone-400 text-sm shrink-0">{abierta ? "▲" : "▼"}</span>
      </button>

      {/* Detalle expandible */}
      {abierta && (
        <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-0.5">Email</span>
              <a
                href={`mailto:${s.email}`}
                className="text-stone-800 hover:text-stone-600 underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                {s.email}
              </a>
            </div>
            {s.telefono && (
              <div>
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-0.5">Teléfono</span>
                <a
                  href={`tel:${s.telefono}`}
                  className="text-stone-800 hover:text-stone-600 underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.telefono}
                </a>
              </div>
            )}
          </div>

          {s.mensaje && (
            <div>
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1">Mensaje</span>
              <p className="text-sm text-stone-700 whitespace-pre-wrap bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
                {s.mensaje}
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <span className="text-xs text-stone-400">
              Recibida el{" "}
              {new Date(s.createdAt).toLocaleDateString("es-ES", {
                day: "numeric", month: "long", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>

            {esPendiente ? (
              <div className="flex gap-2">
                <button
                  onClick={descartar}
                  disabled={procesando}
                  className="px-3 py-1.5 text-xs border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 disabled:opacity-50"
                >
                  {procesando ? "..." : "Descartar"}
                </button>
                <button
                  onClick={aceptar}
                  disabled={procesando}
                  className="px-3 py-1.5 text-xs bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                >
                  {procesando ? "Procesando..." : "Aceptar y enviar invitación"}
                </button>
              </div>
            ) : (
              <span className={`text-xs font-medium ${s.estado === "ACEPTADA" ? "text-emerald-600" : "text-stone-400"}`}>
                {s.estado === "ACEPTADA"
                  ? "Alumno creado · invitación enviada"
                  : "Descartada"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
