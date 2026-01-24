import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ApiKeySettings } from "@/components/shared/ApiKeySettings";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "分鏡圖系統 | Storyboard System",
  description: "AI-powered storyboard generation system with image and video creation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className={cn(
        inter.className,
        "min-h-full bg-background font-sans antialiased"
      )}>
        <div className="fixed inset-0 -z-10 h-full w-full bg-white dark:bg-slate-950 [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)] opacity-20"></div>
        {children}
        <ApiKeySettings />
      </body>
    </html>
  );
}
