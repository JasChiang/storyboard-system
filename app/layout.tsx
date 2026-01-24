import type { Metadata } from "next";
import "./globals.css";
import { ApiKeySettings } from "@/components/shared/ApiKeySettings";

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
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
        <ApiKeySettings />
      </body>
    </html>
  );
}
