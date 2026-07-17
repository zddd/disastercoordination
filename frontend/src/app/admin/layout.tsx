"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getRole } from "@/lib/auth";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";

const ALL_ITEMS = [
  { href: "/admin/dashboard", label: "指挥看板", roles: ["admin", "commander", "zone_commander"] },
  { href: "/admin/review", label: "审核工作台", roles: ["admin", "reviewer"] },
  { href: "/admin/tasks", label: "任务管理", roles: ["admin", "commander"] },
  { href: "/admin/teams", label: "救援队管理", roles: ["admin", "reviewer"] },
  { href: "/admin/disasters", label: "灾害管理", roles: ["admin", "operator"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [mounted, setMounted] = useState(false);
  const [pageTitle, setPageTitle] = useState("");

  useEffect(() => { setRole(getRole() || ""); setMounted(true); }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const item = ALL_ITEMS.find(i => path.startsWith(i.href));
      setPageTitle(item?.label || "");
    }
  }, []);

  const visibleItems = mounted ? ALL_ITEMS.filter(i => i.roles.includes(role)) : [];

  return (
    <div className="drawer lg:drawer-open">
      <input id="admin-drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex flex-col min-h-screen bg-base-200">
        {/* Navbar — slim, with breadcrumbs in start */}
        <div className="navbar bg-base-100 shadow-sm sticky top-0 z-10 min-h-0 py-1 px-3">
          <div className="navbar-start gap-2">
            <label htmlFor="admin-drawer" className="btn btn-ghost btn-xs drawer-button lg:hidden">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
            <div className="breadcrumbs text-xs py-0 hidden lg:flex">
              <ul>
                <li><a href="/admin/dashboard" className="link link-hover">管理后台</a></li>
                {pageTitle && <li className="font-medium">{pageTitle}</li>}
              </ul>
            </div>
          </div>
          <div className="navbar-end gap-1">
            <ThemeSwitcher />
            {/* User menu */}
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-xs btn-circle avatar placeholder">
                <div className="bg-primary text-primary-content w-6 rounded-full">
                  <span className="text-xs">{role?.charAt(0)?.toUpperCase() || "?"}</span>
                </div>
              </div>
              <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-36 z-20 mt-1">
                <li className="menu-title text-xs"><span>角色: {role}</span></li>
                <li><a onClick={() => { clearAuth(); router.push("/login"); }}>退出登录</a></li>
              </ul>
            </div>
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Sidebar */}
      <div className="drawer-side z-20">
        <label htmlFor="admin-drawer" aria-label="close sidebar" className="drawer-overlay" />
        <div className="sidebar w-64 min-h-full flex flex-col relative"
             style={{ minWidth: "180px", maxWidth: "400px" }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-16 bg-base-300 hover:bg-primary cursor-col-resize rounded-full transition-colors"
               style={{ cursor: "col-resize" }}
               onMouseDown={(e) => {
                 const sidebar = e.currentTarget.parentElement!;
                 const startX = e.clientX;
                 const startWidth = sidebar.offsetWidth;
                 const onMove = (ev: MouseEvent) => {
                   const newWidth = startWidth + (ev.clientX - startX);
                   if (newWidth >= 180 && newWidth <= 400) sidebar.style.width = newWidth + "px";
                 };
                 const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                 document.addEventListener("mousemove", onMove);
                 document.addEventListener("mouseup", onUp);
               }} />
          <header className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-content text-sm font-bold">DC</span>
              </div>
              <div><h2 className="font-bold text-sm leading-tight">应急调度中心</h2><p className="text-xs opacity-60">v0.1.0 MVP</p></div>
            </div>
          </header>
          <ul className="menu flex-1 w-full px-3 py-2 gap-0.5 text-sm">
            {visibleItems.map(item => (
              <li key={item.href} className="w-full">
                <a href={item.href} className="rounded-lg">{item.label}</a>
              </li>
            ))}
          </ul>
          <footer className="p-3">
            <div className="flex items-center gap-2 px-3 py-2 text-xs opacity-60">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-xs font-bold">{mounted ? role?.charAt(0)?.toUpperCase() : "?"}</span>
              </div>
              <span>{mounted ? role : "..."}</span>
            </div>
            <button onClick={() => { clearAuth(); router.push("/login"); }}
                    className="btn btn-ghost w-full justify-start btn-xs text-xs normal-case">退出登录</button>
          </footer>
        </div>
      </div>
    </div>
  );
}
