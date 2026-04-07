"use client";

type Alumno = { id: string; name: string | null; email: string };

type Props = {
  abierto: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo: string;
  ocupados?: number;
  aforo?: number;
  alumnos?: Alumno[];
};

export default function FichaSesionModal({
  abierto,
  onClose,
  titulo,
  subtitulo,
  ocupados,
  aforo,
  alumnos = [],
}: Props) {
  if (!abierto) return null;

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
          <h3 className="text-sm font-medium text-stone-700 mb-2">Alumnos inscritos</h3>
          {alumnos.length === 0 ? (
            <p className="text-sm text-stone-400">No hay alumnos listados para esta sesion.</p>
          ) : (
            <ul className="space-y-2">
              {alumnos.map((a) => (
                <li key={a.id} className="bg-stone-50 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-stone-800">{a.name || "Sin nombre"}</p>
                  <p className="text-xs text-stone-500">{a.email}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
