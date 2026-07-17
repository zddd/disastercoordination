"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getRole } from "@/lib/auth";

const ALL_ITEMS = [
  { href: "/admin/dashboard", label: "指挥看板", icon: "📊", roles: ["admin", "commander", "zone_commander"] },
  { href: "/admin/review", label: "审核工作台", icon: "🔍", roles: ["admin", "reviewer"] },
  { href: "/admin/tasks", label: "任务管理", icon: "📋", roles: ["admin", "commander"] },
  { href: "/admin/teams", label: "救援队管理", icon: "👥", roles: ["admin", "reviewer"] },
  { href: "/admin/disasters", label: "灾害管理", icon: "🌍", roles: ["admin", "operator"] },
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

      {/* Main content area */}
      <div className="drawer-content flex flex-col min-h-screen bg-base-200">
        {/* Navbar */}
        <div className="navbar bg-base-100 shadow-sm sticky top-0 z-10 lg:hidden">
          <div className="navbar-start">
            <label htmlFor="admin-drawer" className="btn btn-ghost drawer-button lg:hidden">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
          </div>
          <div className="navbar-center font-bold text-sm">{pageTitle}</div>
          <div className="navbar-end">
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
                <div className="bg-primary text-primary-content w-10 rounded-full">
                  <span className="text-sm">{role?.charAt(0)?.toUpperCase() || "?"}</span>
                </div>
              </div>
              <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-40 z-20 mt-2">
                <li className="menu-title text-xs"><span>角色: {role}</span></li>
                <li><a onClick={() => { clearAuth(); router.push("/login"); }}>退出登录</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="hidden lg:flex px-6 pt-4 pb-0">
          <div className="breadcrumbs text-sm">
            <ul>
              <li><a href="/admin/dashboard">管理后台</a></li>
              {pageTitle && <li>{pageTitle}</li>}
            </ul>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Sidebar drawer */}
      <div className="drawer-side z-20">
        <label htmlFor="admin-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <div className="sidebar w-64 min-h-full flex flex-col">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-lg font-bold tracking-wide">应急调度中心</h2>
            <p className="text-xs text-white/50 mt-1">角色: {mounted ? role : "..."}</p>
          </div>
          <ul className="menu flex-1 p-3 gap-1">
            {visibleItems.map(item => (
              <li key={item.href}>
                <a href={item.href} className="text-white/85 hover:text-white hover:bg-white/10 focus:bg-white/10">
                  <span>{item.icon}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="p-3 border-t border-white/10">
            <button onClick={() => { clearAuth(); router.push("/login"); }}
                    className="btn btn-ghost w-full text-white/50 hover:text-white hover:bg-white/10 btn-sm justify-start normal-case">
              ⏻ 退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
