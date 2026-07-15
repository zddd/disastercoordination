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
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card bg-base-100 w-full max-w-sm shadow-lg">
        <div className="card-body items-center text-center">
          <div className="avatar placeholder mb-3">
            <div className="bg-primary text-primary-content w-16 rounded-xl">
              <span className="text-2xl">+</span>
            </div>
          </div>
          <h2 className="card-title text-2xl">灾害应急调度中心</h2>
          <p className="text-base-content/50 text-sm -mt-2 mb-2">Disaster Coordination Center</p>

          <div className="form-control w-full text-left">
            <label className="label"><span className="label-text">用户名</span></label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                   placeholder="admin" className="input input-bordered w-full" />
          </div>
          <div className="form-control w-full text-left">
            <label className="label"><span className="label-text">密码</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                   placeholder="admin123" className="input input-bordered w-full" />
          </div>

          {error && <div className="alert alert-error text-sm py-2">{error}</div>}

          <button type="submit" disabled={loading} onClick={handleSubmit}
                  className="btn btn-primary w-full text-base">
            {loading ? <span className="loading loading-spinner" /> : null}
            {loading ? "登录中..." : "登 录"}
          </button>

          <p className="text-xs text-base-content/40 pt-2">演示账号 admin / admin123</p>
        </div>
      </div>
    </div>
  );
}
