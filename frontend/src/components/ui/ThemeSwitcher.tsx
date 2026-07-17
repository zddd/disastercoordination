"use client";
import { useEffect, useState } from "react";

const THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
  "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
  "night", "coffee", "winter", "dim", "nord", "sunset", "caramellatte",
  "silk", "abyss",
];

const STORAGE_KEY = "dc-theme";
const DEFAULT_THEME = "light";

/** Apply theme and persist */
export function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

/** Get current theme from DOM or localStorage */
export function getCurrentTheme(): string {
  if (typeof document === "undefined") return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.includes(stored)) return stored;
  } catch {}
  return document.documentElement.getAttribute("data-theme") || DEFAULT_THEME;
}

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState(DEFAULT_THEME);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const theme = getCurrentTheme();
    applyTheme(theme);
    setCurrent(theme);
  }, []);

  const switchTo = (theme: string) => {
    applyTheme(theme);
    setCurrent(theme);
  };

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-xs gap-1 normal-case">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a4 4 0 014-4h10a4 4 0 014 4v12a4 4 0 01-4 4H7z" />
        </svg>
        {current}
      </div>
      <ul tabIndex={0}
          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44 z-30 mt-1
                     grid grid-cols-2 gap-x-1">
        {THEMES.map(t => {
          const isActive = t === current;
          return (
            <li key={t}>
              <a className={`text-xs py-1.5 ${isActive ? "active font-bold" : ""}`}
                 onClick={() => switchTo(t)}>
                {t}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
