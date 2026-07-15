"use client";

import Link from "next/link";

export default function HelpHomePage() {
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-base-content">灾害求助</h1>
        <p className="text-base-content/50 mt-2">请选择您的操作</p>
      </div>

      <Link href="/help/submit" className="btn btn-error btn-block btn-lg">
        我要求助
      </Link>

      <Link href="/help/status" className="btn btn-outline btn-block btn-lg">
        查看求助进度
      </Link>
    </div>
  );
}
