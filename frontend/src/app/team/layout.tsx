"use client";

import { useRouter } from "next/navigation";
import { clearAuth } from "@/lib/auth";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-primary text-primary-content shadow-sm">
        <div className="navbar-start">
          <h1 className="text-lg font-bold">救援任务</h1>
        </div>
        <div className="navbar-end">
          <button onClick={() => { clearAuth(); router.push("/login"); }}
                  className="btn btn-ghost btn-sm text-primary-content">
            退出
          </button>
        </div>
      </div>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
