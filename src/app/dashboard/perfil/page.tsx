"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PerfilContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcePasswordReset = useMemo(() => searchParams.get("resetPassword") === "1", [searchParams]);

  const [notificaciones, setNotificaciones] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [passwordActual, setPasswordActual] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const passwordResetRequired = resetPassword || forcePasswordReset;

  useEffect(() => {
    async function cargar() {
      const res = await fetch("/api/alumno/perfil");
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(Boolean(data.notificaciones));
        setResetPassword(Boolean(data.resetPassword));
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

  async function cambiarPassword() {
    setErrorPassword("");
    setMensajePassword("");

    if (!passwordResetRequired && !passwordActual.trim()) {
      setErrorPassword("Debes indicar tu contraseña actual.");
      return;
    }
    if (nuevaPassword.length < 8) {
      setErrorPassword("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setErrorPassword("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setGuardandoPassword(true);
    const body: { nuevaPassword: string; passwordActual?: string } = { nuevaPassword };
    if (!passwordResetRequired) body.passwordActual = passwordActual;

    const res = await fetch("/api/alumno/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorPassword(data.error || "No se pudo cambiar la contraseña.");
      setGuardandoPassword(false);
      return;
    }

    setMensajePassword("Contraseña actualizada.");
    setPasswordActual("");
    setNuevaPassword("");
    setConfirmarPassword("");
    setResetPassword(false);
    setGuardandoPassword(false);

    if (forcePasswordReset) {
      router.push("/dashboard");
      router.refresh();
    }
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

      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">Cambiar contraseña</h2>

        {passwordResetRequired && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Debes cambiar tu contraseña.
          </div>
        )}
        {errorPassword && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{errorPassword}</div>}
        {mensajePassword && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{mensajePassword}</div>}

        {!passwordResetRequired && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña actual</label>
            <input
              type="password"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Confirmar nueva contraseña</label>
          <input
            type="password"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
          />
        </div>

        <button
          onClick={cambiarPassword}
          disabled={guardandoPassword}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
        >
          {guardandoPassword ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Cargando...</p>}>
      <PerfilContent />
    </Suspense>
  );
}
