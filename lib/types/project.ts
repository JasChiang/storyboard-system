import { Storyboard } from './storyboard';

export type ProjectStatus = 'draft' | 'storyboard' | 'images' | 'videos' | 'complete';

export interface Project {
  id: string;
  name: string;
  description?: string;
  storyboard?: Storyboard;
  blenderScript?: string;
  editingSuggestions?: EditingSuggestion;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EditingSuggestion {
  summary: string;
  scenes: SceneEditSuggestion[];
  timeline: TimelineMarker[];
  audioNotes: string;
}

export interface SceneEditSuggestion {
  sceneId: string;
  inPoint: number;              // 入點 (秒)
  outPoint: number;             // 出點 (秒)
  transition: string;           // 轉場效果
  effects: string[];            // 視覺效果列表
}

export interface TimelineMarker {
  time: number;                 // 時間點 (秒)
  type: 'cut' | 'transition' | 'effect';
  description: string;
}

// Gemini 上傳的檔案資訊
export interface UploadedVideoFile {
  name: string;
  uri: string;
  mimeType: string;
  sceneId: string;              // 對應的場景 ID
}
