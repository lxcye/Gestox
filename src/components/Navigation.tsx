"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", icon: "🏠" },
  { href: "/baux", label: "Baux", icon: "📋" },
  { href: "/locations-saisonnieres", label: "Locations saisonnières", icon: "🏖️" },
  { href: "/bailleurs", label: "Bailleurs", icon: "👤" },
  { href: "/parametres", label: "Paramètres", icon: "⚙️" },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut, user } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-64 min-h-screen bg-gray-900 text-white p-4">
        <div className="text-2xl font-bold mb-8 px-3">Gestox</div>
        <div className="flex-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
        {user && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 px-3 mb-2 truncate">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span>🚪</span>
              <span>Déconnexion</span>
            </button>
          </div>
        )}
      </nav>

      {/* Mobile top bar */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-gray-900 text-white z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="text-xl font-bold">Gestox</span>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-2xl"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
        {menuOpen && (
          <div className="bg-gray-900 pb-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 ${
                  pathname === item.href
                    ? "bg-blue-600"
                    : "hover:bg-gray-800"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            {user && (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-6 py-3 w-full text-gray-300 hover:bg-gray-800 text-left"
              >
                <span>🚪</span>
                <span>Déconnexion</span>
              </button>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
