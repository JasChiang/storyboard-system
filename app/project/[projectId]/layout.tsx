import { ReactNode } from 'react';

export default function ProjectLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen relative overflow-hidden bg-background">
            {/* Background Decor from Home (White Theme) */}
            <div className="pointer-events-none fixed inset-0 flex justify-center overflow-hidden z-0">
                <div className="h-[500px] w-[500px] bg-blue-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 rounded-full mix-blend-multiply dark:mix-blend-color-dodge animate-pulse duration-1000" />
                <div className="h-[500px] w-[500px] bg-blue-500/20 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2 rounded-full mix-blend-multiply dark:mix-blend-color-dodge animate-pulse delay-700 duration-1000" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
