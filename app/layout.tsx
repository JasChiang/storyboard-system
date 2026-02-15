import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { FalConfigProvider } from "@/components/providers/FalConfigProvider";
import { cn } from "@/lib/utils";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

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
      <body className={cn(manrope.variable, manrope.className, "min-h-full bg-background font-sans text-foreground antialiased")}>
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="ambient-orb absolute -left-28 -top-32 h-[22rem] w-[22rem] rounded-full bg-sky-400/25 dark:bg-sky-500/25" />
          <div className="ambient-orb absolute -right-36 top-28 h-[26rem] w-[26rem] rounded-full bg-blue-500/18 dark:bg-blue-400/20 [animation-delay:5s]" />
          <div className="ambient-orb absolute bottom-[-9rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-cyan-300/15 dark:bg-cyan-500/14 [animation-delay:10s]" />
          <div className="absolute inset-x-0 top-24 h-px hairline opacity-70" />
        </div>
        <FalConfigProvider>
          {children}
        </FalConfigProvider>
      </body>
    </html>
  );
}
