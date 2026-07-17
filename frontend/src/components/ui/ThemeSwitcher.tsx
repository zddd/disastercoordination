"use client";
import { useEffect, useRef, useState } from "react";

const THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
  "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
  "night", "coffee", "winter", "dim", "nord", "sunset", "caramellatte",
  "silk", "abyss",
];

const STORAGE_KEY = "dc-theme";
const DEFAULT = "light";

export function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

export function getTheme(): string {
  if (typeof document === "undefined") return DEFAULT;
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT; } catch { return DEFAULT; }
}

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState(DEFAULT);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate
  useEffect(() => {
    setCurrent(getTheme());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const switchTo = (theme: string) => {
    applyTheme(theme);
    setCurrent(theme);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
              className="btn btn-ghost btn-xs gap-1 normal-case">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a4 4 0 014-4h10a4 4 0 014 4v12a4 4 0 01-4 4H7z" />
        </svg>
        {current}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 p-2 bg-base-100 rounded-box shadow-lg border border-base-300 z-50
                        grid grid-cols-3 gap-1">
          {THEMES.map(t => {
            const isActive = t === current;
            return (
              <button key={t} onClick={() => switchTo(t)}
                      className={`btn btn-xs normal-case ${isActive ? "btn-primary" : "btn-ghost"}`}>
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
