'use client';

import { Project } from '@/lib/types/project';
import { Clapperboard, Calendar, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  storyboard: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  images: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  videos: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
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
      <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm transition-all hover:bg-muted/50 hover:shadow-lg hover:border-primary/20">
        <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20",
                "text-primary"
              )}>
                <Clapperboard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1",
                  statusColors[project.status]
                )}>
                  {statusLabels[project.status]}
                </span>
              </div>
            </div>

            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 -mr-2 -mt-2 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
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

          <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(project.createdAt).toLocaleDateString('zh-TW')}</span>
            </div>

            <div className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              {project.storyboard?.scenes.length || 0} 個場景
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
