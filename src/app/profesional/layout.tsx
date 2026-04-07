"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/profesional/calendario", label: "Calendario" },
  { href: "/profesional/reservas", label: "Mis reservas" },
];

export default function ProfesionalLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-stone-800">Amaruzen</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Profesional</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500 hidden sm:block">{session?.user?.name || session?.user?.email}</span>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-stone-600 hover:text-stone-900">
              Salir
            </button>
          </div>
        </div>

        <nav className="border-t border-stone-100 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2.5 px-3 text-sm whitespace-nowrap transition-colors ${
                  pathname === item.href
                    ? "text-stone-900 border-b-2 border-stone-800 font-medium"
                    : "text-stone-500 hover:text-stone-900"
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
