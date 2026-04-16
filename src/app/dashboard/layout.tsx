"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Mi panel" },
  { href: "/dashboard/clases", label: "Mis clases" },
  { href: "/dashboard/cambios", label: "Mis cambios" },
  { href: "/dashboard/perfil", label: "Perfil" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navbar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-stone-800">Amaruzen</span>
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    pathname === item.href
                      ? "bg-stone-100 text-stone-900 font-medium"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500 hidden sm:block">
              {session?.user?.name || session?.user?.email}
            </span>
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.assign("/login");
              }}
              className="text-sm text-stone-600 hover:text-stone-900 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
        {/* Navegación móvil */}
        <nav className="sm:hidden flex border-t border-stone-100 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 text-center py-2 text-xs font-medium transition-colors whitespace-nowrap px-3 ${
                pathname === item.href
                  ? "text-stone-900 border-b-2 border-stone-800"
                  : "text-stone-500"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
