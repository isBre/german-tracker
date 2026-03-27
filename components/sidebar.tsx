"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/sessions",
    label: "Lerneinheiten",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: "/topics",
    label: "Themen",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    href: "/issues",
    label: "Probleme",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Einstellungen",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 1.8 2.48l-1.44 2.49a7 7 0 0 0-1.01-1.74l.65-3.23z" />
        <path d="M21.17 10.18l-2.77-.47a7 7 0 0 0-.32-2l2.33-1.5a10 10 0 0 1 .76 3.97z" />
        <path d="M19.07 19.07a10 10 0 0 1-2.48 1.8l-2.49-1.44a7 7 0 0 0 1.74-1.01l3.23.65z" />
        <path d="M13.82 21.17l.47-2.77a7 7 0 0 0 2-.32l1.5 2.33a10 10 0 0 1-3.97.76z" />
        <path d="M4.93 19.07a10 10 0 0 1-1.8-2.48l1.44-2.49a7 7 0 0 0 1.01 1.74l-.65 3.23z" />
        <path d="M2.83 13.82l2.77.47a7 7 0 0 0 .32 2l-2.33 1.5a10 10 0 0 1-.76-3.97z" />
        <path d="M4.93 4.93a10 10 0 0 1 2.48-1.8l2.49 1.44a7 7 0 0 0-1.74 1.01l-3.23-.65z" />
        <path d="M10.18 2.83l-.47 2.77a7 7 0 0 0-2 .32L6.21 3.59a10 10 0 0 1 3.97-.76z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-slate-100 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-semibold tracking-tight text-slate-900">🇩🇪 German</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Lerntracker</p>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={active ? "text-white" : "text-slate-400"}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">Viel Erfolg! 🎯</p>
      </div>
    </aside>
  );
}
