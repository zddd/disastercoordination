import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灾害应急调度中心 | DC Center",
  description: "灾害应急调度系统 — 连接受灾群众与救援力量",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
