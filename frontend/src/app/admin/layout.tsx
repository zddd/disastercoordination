"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, getRole } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setRole(getRole() || ""); setMounted(true); }, []);

  const navItems = [
    { href: "/admin/dashboard", label: "指挥看板", roles: ["admin", "commander", "zone_commander"] },
    { href: "/admin/review", label: "审核工作台", roles: ["admin", "reviewer"] },
    { href: "/admin/tasks", label: "任务管理", roles: ["admin", "commander"] },
    { href: "/admin/teams", label: "救援队管理", roles: ["admin", "reviewer"] },
    { href: "/admin/disasters", label: "灾害管理", roles: ["admin", "operator"] },
  ];
  const visibleItems = mounted ? navItems.filter(i => i.roles.includes(role)) : [];

  return (
    <div className="flex min-h-screen bg-base-200">
      {/* Sidebar — NOT drawer-side (that's a daisyUI drawer sub-component, defaults hidden) */}
      <aside className="sidebar w-64 flex-shrink-0 flex flex-col min-h-screen">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-bold tracking-wide">应急调度中心</h2>
          <p className="text-xs text-white/50 mt-1" suppressHydrationWarning>角色: {mounted ? role : "..."}</p>
        </div>
        <ul className="menu flex-1 p-3 gap-1">
          {visibleItems.map(item => (
            <li key={item.href}>
              <a href={item.href} className="text-white/80 hover:text-white hover:bg-white/10 focus:bg-white/10">
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
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl">{children}</main>
    </div>
  );
}
