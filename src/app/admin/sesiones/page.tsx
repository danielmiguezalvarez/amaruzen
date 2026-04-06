"use client";

import { useEffect, useState } from "react";

type Sesion = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aforo: number;
  cancelada: boolean;
  clase: {
    nombre: string;
    profesor: { nombre: string };
    sala: { nombre: string };
  };
  _count?: { cambiosComoDestino: number };
};

export default function SesionesPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    // Cargar sesiones de los próximos 30 días
    const res = await fetch("/api/admin/sesiones/lista");
    if (res.ok) {
      const data = await res.json();
      setSesiones(data);
    }
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  async function generar() {
    setGenerando(true);
    setMensaje("");
    const res = await fetch("/api/admin/sesiones", { method: "POST" });
    const data = await res.json();
    setMensaje(`Se generaron ${data.creadas} nuevas sesiones.`);
    setGenerando(false);
    cargar();
  }

  // Agrupar por fecha
  const grupos: Record<string, Sesion[]> = {};
  sesiones.forEach((s) => {
    const fecha = new Date(s.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    if (!grupos[fecha]) grupos[fecha] = [];
    grupos[fecha].push(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Sesiones</h1>
          <p className="text-stone-500 text-sm mt-1">Próximas 4 semanas</p>
        </div>
        <button onClick={generar} disabled={generando}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors">
          {generando ? "Generando..." : "Generar sesiones (2 meses)"}
        </button>
      </div>

      {mensaje && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{mensaje}</div>
      )}

      {loading ? <p className="text-stone-400 text-sm">Cargando...</p> : (
        Object.keys(grupos).length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 px-5 py-12 text-center">
            <p className="text-stone-400 text-sm mb-3">No hay sesiones generadas</p>
            <p className="text-stone-400 text-xs">Pulsa &quot;Generar sesiones&quot; para crear las sesiones de los próximos 2 meses</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grupos).map(([fecha, sesionesDia]) => (
              <div key={fecha}>
                <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 capitalize">{fecha}</h2>
                <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
                  {sesionesDia.map((s) => (
                    <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-stone-800 text-sm">{s.clase.nombre}</p>
                        <p className="text-xs text-stone-500">{s.clase.profesor.nombre} · {s.clase.sala.nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-stone-700">{s.horaInicio} - {s.horaFin}</p>
                        <p className="text-xs text-stone-400">Aforo: {s.aforo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
