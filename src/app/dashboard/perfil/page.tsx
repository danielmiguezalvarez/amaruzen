"use client";

import { useEffect, useState } from "react";

export default function PerfilPage() {
  const [notificaciones, setNotificaciones] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    async function cargar() {
      const res = await fetch("/api/alumno/perfil");
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(Boolean(data.notificaciones));
      }
      setLoading(false);
    }
    cargar();
  }, []);

  async function guardar() {
    setGuardando(true);
    setMensaje("");
    const res = await fetch("/api/alumno/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificaciones }),
    });
    if (res.ok) {
      setMensaje("Preferencias guardadas.");
    }
    setGuardando(false);
  }

  if (loading) return <p className="text-sm text-stone-400">Cargando...</p>;

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Perfil</h1>
        <p className="text-stone-500 text-sm mt-1">Preferencias de notificaciones</p>
      </div>

      {mensaje && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{mensaje}</div>}

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={notificaciones}
            onChange={(e) => setNotificaciones(e.target.checked)}
            className="mt-1 rounded border-stone-300"
          />
          <span>
            <span className="block text-sm font-medium text-stone-800">Recibir notificaciones por email</span>
            <span className="block text-xs text-stone-500 mt-0.5">
              Cancelaciones de clase y respuesta de solicitudes de cambio.
            </span>
          </span>
        </label>

        <button
          onClick={guardar}
          disabled={guardando}
          className="mt-4 px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
