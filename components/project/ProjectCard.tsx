'use client';

import { Project } from '@/lib/types/project';
import { Clapperboard, Calendar, Trash2 } from 'lucide-react';
import Link from 'next/link';

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
  images: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
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
      <div className="group relative bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl transition-all border border-slate-200 dark:border-slate-700 p-6 cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clapperboard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {project.name}
              </h3>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${statusColors[project.status]}`}>
                {statusLabels[project.status]}
              </span>
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-opacity"
            title="刪除專案"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {project.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{new Date(project.createdAt).toLocaleDateString('zh-TW')}</span>
          </div>
          {project.storyboard && (
            <div>
              {project.storyboard.scenes.length} 個場景
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
