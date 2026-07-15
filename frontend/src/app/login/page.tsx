"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuth } from "@/lib/auth";

/**
 * Login page — authenticates user via backend API and redirects based on role.
 * Supports both username and phone-based login.
 */
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

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "登录失败");
        return;
      }

      const data = await res.json();
      const { token, user } = data;

      // Store auth state
      setAuth(token, user);

      // Redirect based on role
      const role = user.role;
      if (role === "victim" || role === "volunteer" || role === "donor") {
        router.push("/help");
      } else if (role === "rescue_team") {
        router.push("/team/tasks");
      } else {
        // admin, commander, reviewer, operator, supply_manager, zone_commander
        router.push("/admin/dashboard");
      }
    } catch {
      setError("服务器连接失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">灾害应急调度中心</h1>
          <p className="text-gray-500 mt-2">Disaster Coordination Center</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white shadow rounded-lg p-6 space-y-4"
        >
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              用户名 / 手机号
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
                         text-base"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
                         text-base"
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-red-600 text-white font-medium rounded-md
                       hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-base min-h-[44px]"
          >
            {loading ? "登录中..." : "登录"}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            支持角色: 管理员 / 指挥员 / 审核员 / 值班员 / 救援队 / 受灾群众
          </p>
        </form>
      </div>
    </div>
  );
}
