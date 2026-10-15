"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { authCall, fetcher } from "@/lib/client/api";
import { ROLE_LABEL } from "@/lib/format";
import { cx } from "@/components/ui";

interface Me {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

const NAV: Array<{ group: string; items: Array<{ href: string; label: string; icon: string }> }> = [
  { group: "General", items: [{ href: "/", label: "Resumen", icon: "◧" }] },
  {
    group: "Operación",
    items: [
      { href: "/monitoreo", label: "Monitoreo en vivo", icon: "◉" },
      { href: "/salidas", label: "Salidas y asignaciones", icon: "⇄" },
    ],
  },
  {
    group: "Transporte",
    items: [
      { href: "/horarios", label: "Horarios", icon: "◷" },
      { href: "/paradas", label: "Paradas", icon: "⌖" },
    ],
  },
  {
    group: "Recursos",
    items: [
      { href: "/buses", label: "Buses", icon: "▣" },
      { href: "/conductores", label: "Conductores", icon: "☺" },
      { href: "/gps", label: "GPS (Hunter)", icon: "⌁" },
    ],
  },
  {
    group: "Administración",
    items: [
      { href: "/usuarios", label: "Usuarios", icon: "◎" },
      { href: "/auditoria", label: "Auditoría", icon: "≣" },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: me } = useSWR<Me>("auth/me", fetcher);

  const logout = async () => {
    await authCall("logout").catch(() => undefined);
    window.location.href = "/panel/login";
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-[900] w-64 flex-col bg-navy text-white transition-transform lg:static lg:flex lg:translate-x-0",
          open ? "flex translate-x-0" : "hidden -translate-x-full lg:flex",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/panel/logo.png" alt="UPS GO" className="h-11 w-auto" />
          <div className="text-xs font-semibold leading-tight text-[#c9dbf0]">
            Panel
            <br />
            administrativo
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#8fb0d6]">{section.group}</div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive(item.href) ? "bg-white/15 text-white" : "text-[#d6e4f3] hover:bg-white/10",
                  )}
                >
                  <span aria-hidden className="w-4 text-center text-gold">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <div className="truncate font-semibold">{me?.name || me?.email || "…"}</div>
          <div className="text-xs text-[#8fb0d6]">{me ? ROLE_LABEL[me.role] ?? me.role : ""}</div>
          <button onClick={() => void logout()} className="mt-3 text-xs font-semibold text-gold hover:underline">
            Cerrar sesión
          </button>
        </div>
      </aside>
      {open ? <div className="fixed inset-0 z-[800] bg-navy/40 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-[700] flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-lg px-2 py-1 text-xl text-navy">☰</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/panel/logo.png" alt="UPS GO" className="h-8 w-auto" />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
