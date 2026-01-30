import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";
import { ApiKeySettings } from "@/components/shared/ApiKeySettings";
import { FalConfigProvider } from "@/components/providers/FalConfigProvider";
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
        <div className="fixed inset-0 -z-10 h-full w-full bg-[#F5F5F0] dark:bg-[#36454F]"></div>
        <FalConfigProvider>
          {children}
          <ApiKeySettings />
        </FalConfigProvider>
      </body>
    </html>
  );
}
