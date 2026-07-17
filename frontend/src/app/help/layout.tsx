"use client";

import { usePathname } from "next/navigation";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/help";
  const isSubmit = pathname.startsWith("/help/submit");
  const isStatus = pathname.includes("/status");

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      {/* Navbar — only shown on subpages (not on /help home) */}
      {!isHome && (
        <div className="navbar bg-base-100 shadow-sm sticky top-0 z-10">
          <div className="navbar-start">
            <a href="/help" className="btn btn-ghost btn-sm text-base-content/70 normal-case gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </a>
          </div>
          <div className="navbar-center">
            <span className="font-medium text-sm">
              {isSubmit ? "发起求助" : isStatus ? "求助进度" : ""}
            </span>
          </div>
          <div className="navbar-end" />
        </div>
      )}

      <main className="flex-1">{children}</main>

      {isHome && (
        <footer className="text-center text-xs text-base-content/30 py-4 border-t border-base-300">
          灾害应急调度中心 v0.1.0
        </footer>
      )}
    </div>
  );
}
