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

      <main className="flex-1 p-4 pb-20">{children}</main>

      {/* Bottom Navigation */}
      <div className="btm-nav bg-base-100">
        <a href="/team/tasks" className="text-primary active">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="btm-nav-label">任务</span>
        </a>
        <a href="/team/map" className="text-base-content/60">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="btm-nav-label">地图</span>
        </a>
      </div>
    </div>
  );
}
