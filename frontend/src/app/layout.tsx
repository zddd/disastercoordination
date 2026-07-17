import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灾害应急调度中心 | DC Center",
  description: "灾害应急调度系统 — 连接受灾群众与救援力量",
};

/** Inline script to apply persisted theme before first paint — avoids flash */
const ThemeScript = `
(function() {
  try {
    var theme = localStorage.getItem("dc-theme");
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: ThemeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
