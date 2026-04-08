"use client";

type Alumno = {
  id: string;
  name: string | null;
  email: string;
  ausente?: boolean;
  cambioEntrante?: boolean;
  cambioSaliente?: boolean;
  esInscrito?: boolean;
};

type Props = {
  abierto: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo: string;
  ocupados?: number;
  aforo?: number;
  alumnos?: Alumno[];
  cargando?: boolean;
  onMoverAlumno?: (alumnoId: string) => void;
  onAusenciaAlumno?: (alumnoId: string) => void;
  onEliminarSesion?: () => void;
};

function etiquetaEstado(a: Alumno) {
  if (a.cambioSaliente) return { texto: "Movido", clase: "bg-orange-100 text-orange-700" };
  if (a.ausente) return { texto: "Ausente", clase: "bg-amber-100 text-amber-700" };
  if (a.cambioEntrante && !a.esInscrito) return { texto: "Viene por cambio", clase: "bg-blue-100 text-blue-700" };
  if (a.cambioEntrante && a.esInscrito) return { texto: "Cambio entrante", clase: "bg-blue-100 text-blue-700" };
  return null;
}

export default function FichaSesionModal({
  abierto,
  onClose,
  titulo,
  subtitulo,
  ocupados,
  aforo,
  alumnos = [],
  cargando = false,
  onMoverAlumno,
  onAusenciaAlumno,
  onEliminarSesion,
}: Props) {
  if (!abierto) return null;

  // Separar: primero los que asisten (inscritos sin ausencia/movimiento + entrantes), luego ausentes/movidos
  const asisten = alumnos.filter((a) => !a.ausente && !a.cambioSaliente);
  const noAsisten = alumnos.filter((a) => a.ausente || a.cambioSaliente);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-800">Ficha de sesion</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
        </div>

        <div className="bg-stone-50 rounded-lg p-3 mb-4">
          <p className="text-sm font-semibold text-stone-800">{titulo}</p>
          <p className="text-xs text-stone-500 mt-1">{subtitulo}</p>
        </div>

        {onEliminarSesion && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onEliminarSesion}
              className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              Eliminar sesion
            </button>
          </div>
        )}

        {typeof ocupados === "number" && typeof aforo === "number" && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-stone-700 mb-1">
              <span>Ocupacion</span>
              <span className="font-semibold">{ocupados}/{aforo}</span>
            </div>
            <div className="h-2 rounded bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-stone-700"
                style={{ width: `${Math.max(0, Math.min(100, (ocupados / Math.max(aforo, 1)) * 100))}%` }}
              />
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-stone-700 mb-2">
            Alumnos {asisten.length > 0 && <span className="text-stone-400 font-normal">({asisten.length} asisten)</span>}
          </h3>
          {cargando ? (
            <p className="text-sm text-stone-400">Cargando alumnos...</p>
          ) : alumnos.length === 0 ? (
            <p className="text-sm text-stone-400">No hay alumnos listados para esta sesion.</p>
          ) : (
            <ul className="space-y-2">
              {asisten.map((a) => {
                const etiqueta = etiquetaEstado(a);
                return (
                  <li key={a.id} className="bg-stone-50 rounded-lg px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-800">{a.name || "Sin nombre"}</p>
                          {etiqueta && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${etiqueta.clase}`}>
                              {etiqueta.texto}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500">{a.email}</p>
                      </div>
                      <div className="flex gap-1">
                        {onMoverAlumno && !a.cambioSaliente && (
                          <button
                            type="button"
                            onClick={() => onMoverAlumno(a.id)}
                            className="px-2 py-1 text-[11px] border border-stone-300 rounded hover:bg-white"
                          >
                            Mover
                          </button>
                        )}
                        {onAusenciaAlumno && !a.ausente && !a.cambioSaliente && a.esInscrito !== false && (
                          <button
                            type="button"
                            onClick={() => onAusenciaAlumno(a.id)}
                            className="px-2 py-1 text-[11px] border border-amber-300 text-amber-700 rounded hover:bg-amber-50"
                          >
                            Ausencia
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}

              {noAsisten.length > 0 && (
                <>
                  <li className="pt-2 pb-1">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">No asisten ({noAsisten.length})</p>
                  </li>
                  {noAsisten.map((a) => {
                    const etiqueta = etiquetaEstado(a);
                    return (
                      <li key={a.id} className="bg-stone-50 rounded-lg px-3 py-2 opacity-60">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-stone-800 line-through">{a.name || "Sin nombre"}</p>
                              {etiqueta && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${etiqueta.clase}`}>
                                  {etiqueta.texto}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-500">{a.email}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
