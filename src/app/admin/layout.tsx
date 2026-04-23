"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/alumnos", label: "Alumnos" },
  { href: "/admin/clases", label: "Clases" },
  { href: "/admin/sesiones", label: "Calendario" },
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/convenios", label: "Convenios" },
  { href: "/admin/cambios", label: "Cambios" },
  { href: "/admin/profesores", label: "Profesores" },
  { href: "/admin/salas", label: "Salas" },
  { href: "/admin/solicitudes", label: "Solicitudes" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [solicitudesSinLeer, setSolicitudesSinLeer] = useState(0);
  const [cambiosPendientes, setCambiosPendientes] = useState(0);

  useEffect(() => {
    async function cargarBadges() {
      try {
        const [resSol, resCam] = await Promise.all([
          fetch("/api/admin/solicitudes"),
          fetch("/api/admin/cambios/badge"),
        ]);
        if (resSol.ok) {
          const data: Array<{ estado: string }> = await resSol.json();
          setSolicitudesSinLeer(data.filter((s) => s.estado === "PENDIENTE").length);
        }
        if (resCam.ok) {
          const data: { count: number } = await resCam.json();
          setCambiosPendientes(data.count);
        }
      } catch {
        // silenciar — no bloquear el layout
      }
    }
    cargarBadges();
  }, [pathname]); // re-fetch al navegar

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navbar */}
      <header className="bg-stone-800 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Amaruzen</span>
            <span className="text-stone-400 text-xs bg-stone-700 px-2 py-0.5 rounded">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-400 hidden sm:block">
              {session?.user?.name || session?.user?.email}
            </span>
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.assign("/login");
              }}
              className="text-sm text-stone-300 hover:text-white transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
        {/* Subnav */}
        <nav className="border-t border-stone-700 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 flex">
            {navItems.map((item) => {
              const esSolicitudes = item.href === "/admin/solicitudes";
              const esCambios = item.href === "/admin/cambios";
              const badgeCount = esSolicitudes ? solicitudesSinLeer : esCambios ? cambiosPendientes : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative py-2.5 px-3 text-sm whitespace-nowrap transition-colors ${
                    pathname === item.href
                      ? "text-white border-b-2 border-white font-medium"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  {item.label}
                  {badgeCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-stone-900 text-[10px] font-bold flex items-center justify-center leading-none">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
