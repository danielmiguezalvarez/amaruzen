"use client";

import { useEffect, useState } from "react";

type Reserva = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  notas: string | null;
  sala: { nombre: string };
};

export default function MisReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/profesional/reservas");
    if (res.ok) setReservas(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Mis reservas</h1>
        <p className="text-stone-500 text-sm mt-1">Estado de tus solicitudes de sala</p>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Cargando...</p>
      ) : reservas.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-5 py-10 text-center text-stone-400 text-sm">
          No tienes reservas todavía.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
          {reservas.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-stone-800">{r.sala.nombre}</p>
                <p className="text-xs text-stone-500">
                  {new Date(r.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {r.horaInicio} - {r.horaFin}
                </p>
                {r.motivo && <p className="text-xs text-stone-400 mt-0.5">{r.motivo}</p>}
                {r.notas && <p className="text-xs text-stone-500 mt-1">Notas admin: {r.notas}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                r.estado === "APROBADA"
                  ? "bg-green-100 text-green-700"
                  : r.estado === "RECHAZADA"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }`}>
                {r.estado}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
