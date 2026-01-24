import { DEFAULT_STORYBOARD_TEMPLATE } from './templates/default';
import { COMMERCIAL_TEMPLATE } from './templates/commercial';
import { MUSIC_VIDEO_TEMPLATE } from './templates/music-video';
import { DOCUMENTARY_TEMPLATE } from './templates/documentary';
import type { PromptTemplate } from '@/lib/types/storyboard';

export const TEMPLATES: PromptTemplate[] = [
    DEFAULT_STORYBOARD_TEMPLATE,
    COMMERCIAL_TEMPLATE,
    MUSIC_VIDEO_TEMPLATE,
    DOCUMENTARY_TEMPLATE,
];

export {
    DEFAULT_STORYBOARD_TEMPLATE,
    COMMERCIAL_TEMPLATE,
    MUSIC_VIDEO_TEMPLATE,
    DOCUMENTARY_TEMPLATE,
};
