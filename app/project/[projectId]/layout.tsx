import { ReactNode } from 'react';

export default function ProjectLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen relative overflow-hidden bg-background">
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="ambient-orb absolute left-[-10rem] top-[-12rem] h-[24rem] w-[24rem] rounded-full bg-sky-400/16 dark:bg-sky-500/18" />
                <div className="ambient-orb absolute right-[-12rem] top-[4rem] h-[26rem] w-[26rem] rounded-full bg-blue-400/13 dark:bg-blue-400/16 [animation-delay:8s]" />
                <div className="absolute inset-x-0 top-20 h-px hairline opacity-65" />
            </div>

            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
