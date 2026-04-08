"use client";

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
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

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
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-stone-300 hover:text-white transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
        {/* Subnav */}
        <nav className="border-t border-stone-700 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2.5 px-3 text-sm whitespace-nowrap transition-colors ${
                  pathname === item.href
                    ? "text-white border-b-2 border-white font-medium"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
