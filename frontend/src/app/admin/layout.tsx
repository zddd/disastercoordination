"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuth, getRole } from "@/lib/auth";

/**
 * Admin Layout — sidebar navigation for management pages.
 * Collapsible on mobile, fixed sidebar on desktop.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = getRole();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const navItems = [
    { href: "/admin/dashboard", label: "指挥看板", roles: ["admin", "commander", "zone_commander"] },
    { href: "/admin/review", label: "审核工作台", roles: ["admin", "reviewer"] },
    { href: "/admin/tasks", label: "任务管理", roles: ["admin", "commander"] },
    { href: "/admin/teams", label: "救援队管理", roles: ["admin", "reviewer"] },
    { href: "/admin/disasters", label: "灾害管理", roles: ["admin", "operator"] },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "block" : "hidden"} md:block w-64 bg-gray-900 text-white flex-shrink-0`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">应急调度中心</h2>
          <p className="text-xs text-gray-400 mt-1">角色: {role}</p>
        </div>
        <nav className="p-2 space-y-1">
          {visibleItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700 mt-auto">
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            退出登录
          </button>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-20 bg-gray-900 text-white p-2 rounded"
      >
        ☰
      </button>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
    </div>
  );
}
