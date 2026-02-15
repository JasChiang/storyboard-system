'use client';

import { ReactNode, useState, useEffect } from 'react';
import { KeyboardShortcutSheet } from '@/components/ui/KeyboardShortcutSheet';

export default function ProjectLayout({ children }: { children: ReactNode }) {
    const [showShortcuts, setShowShortcuts] = useState(false);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (isInput) return;

            if (e.key === '?') {
                e.preventDefault();
                setShowShortcuts(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

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

            <KeyboardShortcutSheet
                isOpen={showShortcuts}
                onClose={() => setShowShortcuts(false)}
            />
        </div>
    );
}
