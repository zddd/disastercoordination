"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Help category options mapped by disaster type
// See design §3.1 for the dynamic form switching strategy
const CATEGORIES_BY_DISASTER: Record<string, { value: string; label: string }[]> = {
  earthquake: [
    { value: "trapped", label: "被困" },
    { value: "injured", label: "受伤" },
    { value: "collapse", label: "倒塌" },
    { value: "missing", label: "失联" },
  ],
  flood: [
    { value: "trapped", label: "被困" },
    { value: "water_shortage", label: "缺水" },
    { value: "food_shortage", label: "缺食" },
    { value: "transfer", label: "需要转移" },
  ],
  typhoon: [
    { value: "trapped", label: "被困" },
    { value: "collapse", label: "建筑受损" },
    { value: "transfer", label: "需要转移" },
  ],
};

const URGENCY_OPTIONS = [
  { value: "critical", label: "紧急", desc: "刻不容缓" },
  { value: "normal", label: "一般", desc: "需要尽快救助" },
  { value: "mild", label: "轻微", desc: "非紧急但需要帮助" },
];

interface Disaster {
  id: string;
  name: string;
  type: string;
  level: string;
}

type Step = "disaster" | "details" | "confirm";

export default function HelpSubmitPage() {
  const router = useRouter();

  // State
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [selectedDisaster, setSelectedDisaster] = useState<string>("");
  const [disasterType, setDisasterType] = useState<string>("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [description, setDescription] = useState("");
  const [affectedCount, setAffectedCount] = useState(1);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [files, setFiles] = useState<File[]>([]);

  const [step, setStep] = useState<Step>("disaster");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");

  // Fetch active disasters on mount
  useEffect(() => {
    fetch("http://localhost:8080/api/v1/disasters/active")
      .then((r) => r.json())
      .then((data) => setDisasters(data.disasters || []))
      .catch(() => setError("无法获取灾害信息"));
  }, []);

  // Get GPS location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {
          setLocationError("无法获取GPS位置，将使用IP定位");
          // Fallback: use IP-based geolocation
          fetch("https://ipapi.co/json/")
            .then((r) => r.json())
            .then((data) => {
              if (data.latitude) {
                setLat(data.latitude);
                setLng(data.longitude);
              }
            })
            .catch(() => {});
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, []);

  const categories = CATEGORIES_BY_DISASTER[disasterType] || [
    { value: "custom", label: "自定义" },
  ];

  // SOS: one-tap emergency submit (skips all form steps)
  const handleSOS = async () => {
    if (!selectedDisaster) {
      setError("请先选择灾害");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("disaster_id", selectedDisaster);
      formData.append("category", "custom");
      formData.append("urgency", "critical");
      formData.append("description", "紧急求助！");
      formData.append("affected_count", "1");
      formData.append("latitude", String(lat));
      formData.append("longitude", String(lng));

      const res = await fetch("http://localhost:8080/api/v1/helps", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // If failed, save to localStorage for offline retry
        const pending = JSON.parse(localStorage.getItem("pending_help_requests") || "[]");
        pending.push({
          disaster_id: selectedDisaster,
          category: "custom",
          urgency: "critical",
          description: "紧急求助！",
          lat,
          lng,
          timestamp: Date.now(),
        });
        localStorage.setItem("pending_help_requests", JSON.stringify(pending));
        setError("网络异常，已暂存本地，恢复后将自动提交");
        return;
      }

      const data = await res.json();
      router.push(`/help/${data.help_id}/status`);
    } catch {
      setError("服务器连接失败");
    } finally {
      setLoading(false);
    }
  };

  // Normal form submit
  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      // Upload attachments first
      const attachmentIds: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("http://localhost:8080/api/v1/files/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          attachmentIds.push(data.file_id);
        }
      }

      // Submit help request
      const helpForm = new FormData();
      helpForm.append("disaster_id", selectedDisaster);
      helpForm.append("category", category);
      helpForm.append("urgency", urgency);
      helpForm.append("description", description);
      helpForm.append("affected_count", String(affectedCount));
      helpForm.append("latitude", String(lat));
      helpForm.append("longitude", String(lng));
      if (contactName) helpForm.append("contact_name", contactName);
      if (phone) helpForm.append("phone", phone);

      const res = await fetch("http://localhost:8080/api/v1/helps", {
        method: "POST",
        body: helpForm,
      });

      if (!res.ok) {
        throw new Error("提交失败");
      }

      const data = await res.json();
      router.push(`/help/${data.help_id}/status`);
    } catch {
      setError("提交失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // Check for pending offline requests
  useEffect(() => {
    const checkPending = async () => {
      if (!navigator.onLine) return;
      const pending = JSON.parse(localStorage.getItem("pending_help_requests") || "[]");
      if (pending.length === 0) return;

      for (const req of pending) {
        try {
          const formData = new FormData();
          formData.append("disaster_id", req.disaster_id);
          formData.append("category", req.category);
          formData.append("urgency", req.urgency);
          formData.append("description", req.description);
          formData.append("latitude", String(req.lat));
          formData.append("longitude", String(req.lng));

          await fetch("http://localhost:8080/api/v1/helps", { method: "POST", body: formData });
        } catch {
          return; // Stop on first failure
        }
      }
      localStorage.removeItem("pending_help_requests");
    };

    window.addEventListener("online", checkPending);
    return () => window.removeEventListener("online", checkPending);
  }, []);

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* SOS Button — always visible at top */}
      <button
        onClick={handleSOS}
        disabled={loading}
        className="w-full py-4 bg-red-600 text-white text-lg font-bold rounded-lg
                   hover:bg-red-700 active:bg-red-800
                   disabled:opacity-50 disabled:cursor-not-allowed
                   mb-6 min-h-[44px] animate-pulse"
      >
        {loading ? "发送中..." : "一键求救 SOS"}
      </button>

      {/* Step 1: Select disaster */}
      {step === "disaster" && (
        <div className="bg-white rounded-lg p-4 shadow space-y-4">
          <h2 className="text-lg font-bold">当前灾害</h2>
          {disasters.length === 0 && <p className="text-gray-500">暂无活跃灾害</p>}
          {disasters.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDisaster(d.id);
                setDisasterType(d.type);
                setCategory("");
              }}
              className={`w-full text-left p-3 rounded border min-h-[44px] ${
                selectedDisaster === d.id
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200"
              }`}
            >
              <span className="font-medium">{d.name}</span>
              <span className="ml-2 text-sm text-gray-500">
                {d.type} · {d.level}
              </span>
            </button>
          ))}
          <button
            onClick={() => selectedDisaster && setStep("details")}
            disabled={!selectedDisaster}
            className="w-full py-3 bg-red-600 text-white rounded-md font-medium
                       disabled:opacity-50 min-h-[44px]"
          >
            下一步
          </button>
        </div>
      )}

      {/* Step 2: Help details */}
      {step === "details" && (
        <div className="bg-white rounded-lg p-4 shadow space-y-4">
          <h2 className="text-lg font-bold">求助信息</h2>

          {/* Category based on disaster type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">求助类型</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`p-3 rounded border text-sm min-h-[44px] ${
                    category === c.value ? "border-red-500 bg-red-50" : "border-gray-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">紧急程度</label>
            <div className="space-y-2">
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setUrgency(opt.value)}
                  className={`w-full text-left p-3 rounded border min-h-[44px] ${
                    urgency === opt.value ? "border-red-500 bg-red-50" : "border-gray-200"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="ml-2 text-xs text-gray-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Affected count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">受影响人数</label>
            <input
              type="number"
              min={1}
              value={affectedCount}
              onChange={(e) => setAffectedCount(Number(e.target.value))}
              className="w-full p-2 border rounded min-h-[44px]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              详细描述 <span className="text-xs text-gray-400">({description.length}/500)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full p-2 border rounded"
              placeholder="请描述您遇到的情况..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              现场照片 (最多5张)
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              capture="environment"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (files.length + selected.length > 5) {
                  setError("最多上传5个文件");
                  return;
                }
                setFiles([...files, ...selected]);
              }}
              className="w-full text-sm"
            />
            {files.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">已选择 {files.length} 个文件</p>
            )}
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-700 mb-1">联系人</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full p-2 border rounded min-h-[44px]"
                placeholder="姓名"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 border rounded min-h-[44px]"
                placeholder="13800138000"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("disaster")} className="flex-1 py-3 border rounded min-h-[44px]">
              上一步
            </button>
            <button
              onClick={() => category && setStep("confirm")}
              disabled={!category}
              className="flex-1 py-3 bg-red-600 text-white rounded disabled:opacity-50 min-h-[44px]"
            >
              确认
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm & Submit */}
      {step === "confirm" && (
        <div className="bg-white rounded-lg p-4 shadow space-y-4">
          <h2 className="text-lg font-bold">确认提交</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">求助类型：</span>
              {categories.find((c) => c.value === category)?.label || category}</p>
            <p><span className="text-gray-500">紧急程度：</span>
              {URGENCY_OPTIONS.find((o) => o.value === urgency)?.label}</p>
            <p><span className="text-gray-500">影响人数：</span>{affectedCount}人</p>
            {description && <p><span className="text-gray-500">描述：</span>{description.slice(0, 30)}...</p>}
            {locationError && <p className="text-yellow-600 text-xs">{locationError}</p>}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setStep("details")} className="flex-1 py-3 border rounded min-h-[44px]">
              修改
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-red-600 text-white rounded font-medium
                         disabled:opacity-50 min-h-[44px]"
            >
              {loading ? "提交中..." : "提交求助"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
