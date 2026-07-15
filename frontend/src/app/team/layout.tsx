"use client";

import { useRouter } from "next/navigation";
import { clearAuth } from "@/lib/auth";

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-red-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-lg font-bold">救援任务</h1>
        <button onClick={handleLogout} className="text-sm text-red-100 hover:text-white">
          退出
        </button>
      </header>
      <main className="flex-1 p-4 pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-10">
        <div className="flex justify-around max-w-lg mx-auto">
          <a href="/team/tasks" className="flex flex-col items-center py-2 px-4 text-red-600 min-h-[44px] justify-center">
            <span className="text-xs mt-1">任务</span>
          </a>
          <a href="/team/map" className="flex flex-col items-center py-2 px-4 text-gray-500 min-h-[44px] justify-center">
            <span className="text-xs mt-1">地图</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
