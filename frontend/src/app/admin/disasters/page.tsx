"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Disaster {
  id: string;
  name: string;
  type: string;
  level: string;
  status: string;
  started_at: string;
  closed_at: string | null;
}

export default function DisastersPage() {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "earthquake", level: "red" });

  const loadDisasters = () => {
    authFetch("/disasters")
      .then((r) => r.json())
      .then((data) => setDisasters(data.disasters || []))
      .catch(() => {});
  };

  useEffect(() => { loadDisasters(); }, []);

  const handleCreate = async () => {
    await authFetch("/disasters", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setShowCreate(false);
    loadDisasters();
  };

  const handleClose = async (id: string) => {
    if (!confirm("确认关闭此灾害？")) return;
    await authFetch(`/disasters/${id}/close`, { method: "PUT" });
    loadDisasters();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">灾害管理</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-red-600 text-white rounded text-sm">
          创建灾害
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-4 border space-y-3">
          <h3 className="font-bold">创建新灾害</h3>
          <input type="text" placeholder="灾害名称" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded p-2" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded p-2">
            <option value="earthquake">地震</option><option value="flood">洪涝</option>
            <option value="typhoon">台风</option><option value="epidemic">疫情</option>
            <option value="other">其他</option>
          </select>
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
            className="w-full border rounded p-2">
            <option value="red">红色</option><option value="orange">橙色</option>
            <option value="yellow">黄色</option><option value="blue">蓝色</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border rounded">取消</button>
            <button onClick={handleCreate} className="flex-1 py-2 bg-red-600 text-white rounded">创建</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr><th className="p-3 text-left">名称</th><th className="p-3 text-left">类型/等级</th><th className="p-3 text-left">状态</th><th className="p-3 text-left">操作</th></tr>
          </thead>
          <tbody>
            {disasters.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-3 font-medium">{d.name}</td>
                <td className="p-3 text-gray-500">{d.type} · <span className={`text-xs px-1 rounded ${d.level === "red" ? "bg-red-100 text-red-700" : d.level === "orange" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{d.level}</span></td>
                <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${d.status === "active" ? "bg-green-100 text-green-700" : d.status === "closed" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}>{d.status === "active" ? "活跃" : d.status === "closed" ? "已关闭" : d.status}</span></td>
                <td className="p-3">{d.status === "active" && <button onClick={() => handleClose(d.id)} className="text-xs text-red-600 hover:underline">关闭</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {disasters.length === 0 && <p className="p-8 text-center text-gray-500">暂无灾害记录</p>}
      </div>
    </div>
  );
}
