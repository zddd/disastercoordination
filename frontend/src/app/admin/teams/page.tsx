"use client";

import { useEffect, useState } from "react";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";

interface Team {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  contact_phone: string;
  member_count: number;
  status: string;
  verified: boolean;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    fetch("http://localhost:8080/api/v1/teams")
      .then((r) => r.json())
      .then((data) => setTeams(data.teams || []))
      .catch(() => {});
  }, []);

  const handleVerify = async (teamId: string) => {
    await fetch(`http://localhost:8080/api/v1/teams/${teamId}/verify`, { method: "POST" });
    window.location.reload();
  };

  const handleReject = async (teamId: string) => {
    const reason = prompt("拒绝原因:");
    if (!reason) return;
    await fetch(`http://localhost:8080/api/v1/teams/${teamId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">救援队管理</h1>

      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold">{team.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    team.type === "registered" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {team.type === "registered" ? "注册救援队" : "民间救援力量"}
                  </span>
                  {team.verified && <span className="text-xs text-green-600">已认证</span>}
                  {!team.verified && team.status === "pending" && (
                    <span className="text-xs text-yellow-600">待审核</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {team.capabilities?.map((c) => (
                    <span key={c} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{c}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {team.contact_phone} · {team.member_count}人
                </p>
              </div>
              {!team.verified && team.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerify(team.id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => handleReject(team.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded"
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {teams.length === 0 && <p className="text-gray-500 text-center py-8">暂无注册救援队</p>}
      </div>
    </div>
  );
}
