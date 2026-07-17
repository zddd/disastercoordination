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
    setError(""); setLoading(true);
    try {
      const res = await fetch("http://localhost:8080/api/v1/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) { setError((await res.json()).error || "登录失败"); return; }
      const { token, user } = await res.json();
      setAuth(token, user);
      if (user.role === "victim" || user.role === "volunteer" || user.role === "donor") router.push("/help");
      else if (user.role === "rescue_team") router.push("/team/tasks");
      else router.push("/admin/dashboard");
    } catch { setError("服务器连接失败"); }
    finally { setLoading(false); }
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content w-full max-w-sm">
        <div className="card bg-base-100 shadow-xl w-full">
          <div className="card-body items-center text-center gap-4">
            {/* Avatar */}
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content w-20 rounded-full">
                <span className="text-3xl">DC</span>
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold">灾害应急调度中心</h1>
              <p className="text-base-content/50 text-sm mt-1">Disaster Coordination Center</p>
            </div>

            <div className="divider my-0" />

            {/* Form */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text font-medium">用户名</span>
              </label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                     placeholder="请输入用户名" className="input input-bordered w-full" />
            </div>

            <div className="form-control w-full">
              <label className="label">
                <span className="label-text font-medium">密码</span>
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                     placeholder="请输入密码" className="input input-bordered w-full" />
            </div>

            {error && (
              <div className="alert alert-error text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} onClick={handleSubmit}
                    className="btn btn-primary w-full">
              {loading ? <span className="loading loading-spinner loading-sm" /> : null}
              {loading ? " 登录中..." : "登 录"}
            </button>

            <div className="text-xs text-base-content/40">
              演示账号：admin / admin123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
