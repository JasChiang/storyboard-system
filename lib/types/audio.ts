export interface IndexTtsEmotionalStrengths {
  happy?: number;
  angry?: number;
  sad?: number;
  afraid?: number;
  disgusted?: number;
  melancholic?: number;
  surprised?: number;
  calm?: number;

  // Legacy aliases (will be normalized before submitting to FAL)
  happiness?: number;
  anger?: number;
  fear?: number;
  sadness?: number;
  disgust?: number;
  surprise?: number;
  neutral?: number;
}

export interface IndexTtsRequestInput {
  audio_url: string;
  prompt: string;
  emotional_audio_url?: string;
  strength?: number;
  emotional_strengths?: IndexTtsEmotionalStrengths;
  should_use_prompt_for_emotion?: boolean;
  emotion_prompt?: string;
}

export interface IndexTtsScenePlanningInput {
  sceneId: string;
  sceneNumber: number;
  duration: number;
  description?: string;
  dialogue?: string;
  notes?: string;
  sourceLabel: 'dialogue' | 'description';
  sourceText: string;
}

export interface IndexTtsScenePlan {
  sceneId: string;
  sceneNumber: number;
  sourceLabel: 'dialogue' | 'description';
  sourceText: string;
  payload: IndexTtsRequestInput;
  reasoning?: string;
}

export interface ElevenLabsMusicPromptIdea {
  prompt: string;
  reasoning?: string;
  mood?: string;
  energy?: 'low' | 'medium' | 'high';
}
