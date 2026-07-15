"use client";

import { usePathname } from "next/navigation";

const navItems = [
  { href: "/help", label: "求助", icon: "🔴" },
  { href: "/help/status", label: "进度", icon: "✅" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 md:hidden">
      <div className="flex justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-4 min-h-[44px] justify-center ${
                active ? "text-primary" : "text-base-content/60"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
