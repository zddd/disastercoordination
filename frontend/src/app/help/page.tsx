import Link from "next/link";

export default function HelpHomePage() {
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900">灾害求助</h1>
        <p className="text-gray-500 mt-2">请选择您的操作</p>
      </div>

      <Link
        href="/help/submit"
        className="block w-full py-4 bg-red-600 text-white text-center text-lg font-bold rounded-lg
                   hover:bg-red-700 min-h-[44px]"
      >
        我要求助
      </Link>

      <Link
        href="/help/status"
        className="block w-full py-4 bg-white border border-gray-300 text-center text-lg
                   rounded-lg hover:bg-gray-50 min-h-[44px]"
      >
        查看求助进度
      </Link>
    </div>
  );
}
