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
  profesional: { name: string | null; email: string };
};

export default function AdminReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState<Record<string, string>>({});

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/admin/reservas");
    if (res.ok) setReservas(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function responder(id: string, estado: "APROBADA" | "RECHAZADA") {
    const res = await fetch(`/api/admin/reservas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, notas: notas[id] || null }),
    });

    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "No se pudo actualizar la reserva");
      return;
    }
    cargar();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Reservas</h1>
        <p className="text-stone-500 text-sm mt-1">Solicitudes de salas por profesionales</p>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Cargando...</p>
      ) : reservas.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-5 py-10 text-center text-stone-400 text-sm">
          No hay reservas.
        </div>
      ) : (
        <div className="space-y-3">
          {reservas.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-800">{r.sala.nombre}</p>
                  <p className="text-sm text-stone-500">
                    {new Date(r.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {r.horaInicio} - {r.horaFin}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">{r.profesional.name || "Sin nombre"} · {r.profesional.email}</p>
                  {r.motivo && <p className="text-xs text-stone-500 mt-1">Motivo: {r.motivo}</p>}
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

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  value={notas[r.id] ?? r.notas ?? ""}
                  onChange={(e) => setNotas((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Nota opcional para el profesional"
                  className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
                <button onClick={() => responder(r.id, "APROBADA")} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-500">Aprobar</button>
                <button onClick={() => responder(r.id, "RECHAZADA")} className="px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
