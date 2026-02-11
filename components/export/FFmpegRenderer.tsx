'use client';

import { useState } from 'react';
import { Play, Download, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Storyboard } from '@/lib/types/storyboard';

interface FFmpegRendererProps {
  projectId: string;
  projectName: string;
  storyboard: Storyboard;
}

export function FFmpegRenderer({
  projectId,
  projectName,
  storyboard,
}: FFmpegRendererProps) {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeSubtitles, setIncludeSubtitles] = useState(true);

  const scenes = storyboard.scenes;
  const scenesWithMedia = scenes.filter(s => s.generatedImage || s.generatedVideo);
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

  const handleRender = async () => {
    setIsRendering(true);
    setError(null);
    setVideoUrl(null);
    setRenderProgress(0);

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setRenderProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 500);

      const response = await fetch('/api/ffmpeg/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          scenes,
          projectTitle: projectName,
          includeSubtitles,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '渲染失败');
      }

      const result = await response.json();

      if (result.success) {
        setRenderProgress(100);
        setVideoUrl(result.videoUrl);
        console.log('渲染成功:', result);
      } else {
        throw new Error(result.error || '渲染失败');
      }

    } catch (err) {
      console.error('FFmpeg 渲染错误:', err);
      setError(err instanceof Error ? err.message : '渲染失败');
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            FFmpeg 快速渲染
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            自动合成所有场景，无需手动操作
          </p>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{scenes.length}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">场景数</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{scenesWithMedia.length}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">已生成素材</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalDuration.toFixed(1)}s</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">总时长</div>
        </div>
      </div>

      {/* 渲染選項 */}
      <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <label htmlFor="include-subtitles" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          燒入字幕
        </label>
        <input
          id="include-subtitles"
          type="checkbox"
          checked={includeSubtitles}
          onChange={e => setIncludeSubtitles(e.target.checked)}
          className="w-4 h-4 accent-orange-600 cursor-pointer"
        />
      </div>

      {/* 功能说明 */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          自动处理功能：
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <li>✅ 场景自动拼接</li>
          <li>✅ 转场效果（Fade/Dissolve）</li>
          <li>{includeSubtitles ? '✅' : '☐'} 字幕自动叠加</li>
          <li>✅ H.264 编码，1080p 输出</li>
        </ul>
      </div>

      {/* 渲染按钮 */}
      {!videoUrl && !isRendering && (
        <>
          {scenesWithMedia.length === 0 ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                至少需要一个场景生成了图片或视频才能渲染
              </p>
            </div>
          ) : (
            <Button
              onClick={handleRender}
              disabled={isRendering}
              className="w-full"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              开始渲染
            </Button>
          )}
        </>
      )}

      {/* 渲染进度 */}
      {isRendering && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">渲染进度</span>
            <span className="font-medium text-slate-900 dark:text-white">{renderProgress}%</span>
          </div>
          <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-orange-600 dark:bg-orange-500 transition-all duration-300"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在使用 FFmpeg 合成视频，请稍候...
          </p>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRender}
            className="mt-3"
          >
            重试
          </Button>
        </div>
      )}

      {/* 渲染完成 - 视频播放器 */}
      {videoUrl && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" />
              渲染完成！
            </p>

            {/* 视频播放器 */}
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg bg-black"
              style={{ maxHeight: '500px' }}
            >
              您的浏览器不支持视频播放
            </video>
          </div>

          {/* 下载按钮 */}
          <div className="flex gap-3">
            <Button
              onClick={() => {
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = `${projectName}.mp4`;
                a.click();
              }}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              下载视频
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setVideoUrl(null);
                setRenderProgress(0);
              }}
            >
              重新渲染
            </Button>
          </div>
        </div>
      )}

      {/* 说明 */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          💡 提示：FFmpeg 在服务器端渲染，速度快且免费。如需精细編輯，請使用 OpenReel 或 Blender。
        </p>
      </div>
    </div>
  );
}
