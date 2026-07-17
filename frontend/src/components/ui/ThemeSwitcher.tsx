"use client";
import { useEffect, useState } from "react";

// Available daisyUI themes — same list as in globals.css plugin config
const THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
  "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
  "night", "coffee", "winter", "dim", "nord", "sunset", "caramellatte",
  "silk", "abyss",
];

/**
 * ThemeSwitcher — dropdown to change daisyUI theme at runtime.
 * Updates document.documentElement data-theme attribute.
 */
export default function ThemeSwitcher() {
  const [current, setCurrent] = useState("light");

  useEffect(() => {
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    setCurrent(theme);
  }, []);

  const switchTo = (theme: string) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dc-theme", theme);
    setCurrent(theme);
  };

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-1 normal-case">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a4 4 0 014-4h10a4 4 0 014 4v12a4 4 0 01-4 4H7z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 11h.01M7 15h.01" />
        </svg>
        主题
      </div>
      <ul tabIndex={0}
          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-30 mt-2 max-h-80 overflow-y-auto">
        <li className="menu-title"><span>选择主题</span></li>
        {THEMES.map(t => (
          <li key={t}>
            <a className={t === current ? "active" : ""}
               onClick={() => switchTo(t)}>
              <span className="w-3 h-3 rounded-full border border-base-content/20 mr-2"
                    style={{ background: t === "light" ? "#f0f9ff" : t === "dark" ? "#1e293b" : "var(--fallback-bc, #ccc)" }} />
              {t}
              {t === current && <span className="ml-auto text-xs opacity-50">✓</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
