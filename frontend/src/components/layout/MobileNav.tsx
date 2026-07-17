"use client";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="btm-nav bg-base-100 md:hidden">
      <a href="/help" className={pathname === "/help" ? "active text-primary" : "text-base-content/60"}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="btm-nav-label">求助</span>
      </a>
    </div>
  );
}
