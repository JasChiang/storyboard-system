'use client';

import { Project } from '@/lib/types/project';
import { Clapperboard, Calendar, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

const statusLabels: Record<Project['status'], string> = {
  draft: '草稿',
  storyboard: '分鏡腳本',
  images: '圖片生成',
  videos: '影片生成',
  complete: '完成',
};

const statusColors: Record<Project['status'], string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
  storyboard: 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  images: 'border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  videos: 'border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  complete: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm(`確定要刪除專案「${project.name}」嗎？`)) {
      onDelete(project.id);
    }
  };

  return (
    <Link href={`/project/${project.id}`}>
      <div className="surface-panel group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/25">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent opacity-70" />

        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={cn("surface-inset flex h-12 w-12 items-center justify-center rounded-xl text-primary")}>
                <Clapperboard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {project.name}
                </h3>
                <span className={cn(
                  "mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  statusColors[project.status]
                )}>
                  {statusLabels[project.status]}
                </span>
              </div>
            </div>

            <button
              onClick={handleDelete}
              className="-mr-2 -mt-2 rounded-full p-2 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              title="刪除專案"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">
              {project.description}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(project.createdAt).toLocaleDateString('zh-TW')}</span>
            </div>

            <div className="rounded-full border border-border/70 bg-white/65 px-2.5 py-1 text-xs font-medium text-muted-foreground dark:bg-slate-900/55">
              {project.storyboard?.scenes.length || 0} 個場景
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
