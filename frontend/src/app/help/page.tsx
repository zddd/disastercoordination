"use client";

import Link from "next/link";

export default function HelpHomePage() {
  return (
    <div className="max-w-lg mx-auto p-4 space-y-6 pt-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
          <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-lg text-base-content/70">如果您正在经历灾害，请立即求助</p>
          <p className="text-sm text-base-content/40 mt-1">选择下方操作开始</p>
        </div>
      </div>

      <div className="space-y-3">
        <Link href="/help/submit" className="btn btn-primary btn-block btn-lg">
          发起求助
        </Link>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-2">
            <p className="text-sm font-medium">已有求助编号？</p>
            <input type="text" placeholder="输入求助编号查看进度" id="trackId"
                   className="input input-bordered w-full"
                   onKeyDown={e => { if(e.key==="Enter"){ window.location.href="/help/"+(e.target as HTMLInputElement).value+"/status"; }}} />
            <p className="text-xs text-base-content/40">提交求助后会获得一个编号，在此输入可查看救援进度</p>
          </div>
        </div>
      </div>
    </div>
  );
}
