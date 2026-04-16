"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function ActivarCuentaForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Enlace inválido");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/acceso/activar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "No se pudo activar la cuenta");
      return;
    }

    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="text-xl font-semibold text-stone-800 mb-2">Activar cuenta</h1>
        <p className="text-sm text-stone-500 mb-6">Define una contraseña para acceder a Amaruzen.</p>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-20 border border-stone-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-700"
              >
                {showPasswords ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Confirmar contraseña</label>
            <input
              type={showPasswords ? "text" : "password"}
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? "Activando..." : "Activar cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ActivarCuentaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500">Cargando...</div>}>
      <ActivarCuentaForm />
    </Suspense>
  );
}
