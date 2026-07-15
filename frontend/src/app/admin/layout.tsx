"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getRole } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setRole(getRole() || ""); setMounted(true); }, []);

  const handleLogout = () => { clearAuth(); router.push("/login"); };

  const navItems = [
    { href: "/admin/dashboard", label: "指挥看板", roles: ["admin", "commander", "zone_commander"], icon: "📊" },
    { href: "/admin/review", label: "审核工作台", roles: ["admin", "reviewer"], icon: "🔍" },
    { href: "/admin/tasks", label: "任务管理", roles: ["admin", "commander"], icon: "📋" },
    { href: "/admin/teams", label: "救援队管理", roles: ["admin", "reviewer"], icon: "👥" },
    { href: "/admin/disasters", label: "灾害管理", roles: ["admin", "operator"], icon: "🌍" },
  ];

  const visibleItems = mounted ? navItems.filter(i => i.roles.includes(role)) : [];

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className={`${sidebarOpen ? "block" : "hidden"} md:block w-64 sidebar flex-shrink-0 flex flex-col`}>
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-bold tracking-wide">应急调度中心</h2>
          <p className="text-xs text-white/50 mt-1" suppressHydrationWarning>
            角色: {mounted ? role : "..."}
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map(item => (
            <a key={item.href} href={item.href}
               className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/10 transition-colors">
              <span>{item.icon}</span>{item.label}
            </a>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            ⏻ 退出登录
          </button>
        </div>
      </aside>

      <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden fixed top-3 left-3 z-20 sidebar text-white p-2 rounded-lg shadow-lg">
        ☰
      </button>

      <main className="flex-1 p-5 md:p-8 overflow-auto max-w-7xl">{children}</main>
    </div>
  );
}
