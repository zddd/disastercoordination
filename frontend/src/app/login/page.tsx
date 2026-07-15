"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) { setError((await res.json()).error || "登录失败"); return; }
      const { token, user } = await res.json();
      setAuth(token, user);
      if (user.role === "victim" || user.role === "volunteer" || user.role === "donor") router.push("/help");
      else if (user.role === "rescue_team") router.push("/team/tasks");
      else router.push("/admin/dashboard");
    } catch {
      setError("服务器连接失败");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">灾害应急调度中心</h1>
          <p className="text-slate-400 mt-1 text-sm">Disaster Coordination Center</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">用户名</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="admin"
              className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="admin123"
              className="input-field" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full btn-primary text-base !py-3 !bg-primary-600 hover:!bg-primary-700">
            {loading ? "登录中..." : "登 录"}
          </button>
          <p className="text-xs text-slate-400 text-center pt-2">
            演示账号 admin / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
