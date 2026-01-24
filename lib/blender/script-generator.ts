import { EditingSuggestion } from '../types/project';
import type { Scene } from '../types/storyboard';

export interface BlenderScriptOptions {
    projectName: string;
    scenes: Scene[];
    editingSuggestion?: EditingSuggestion;
    fps?: number;
    resolution?: { width: number; height: number };
}

// 建立場景索引到影片索引的映射
interface VideoMapping {
    sceneIndex: number;
    videoIndex: number;
    scene: Scene;
}

export function generateBlenderScript(options: BlenderScriptOptions): string {
    const {
        projectName,
        scenes,
        editingSuggestion,
        fps = 30,
        resolution = { width: 1920, height: 1080 },
    } = options;

    // 建立影片映射表
    const videoMappings: VideoMapping[] = [];
    let videoIndex = 0;
    scenes.forEach((scene, sceneIndex) => {
        if (scene.generatedVideo) {
            videoMappings.push({ sceneIndex, videoIndex, scene });
            videoIndex++;
        }
    });

    const script = `import bpy
import os

# Blender 自動剪輯腳本
# 專案: ${projectName}
# 生成時間: ${new Date().toISOString()}
# 影片片段數: ${videoMappings.length}

# 設定場景
bpy.context.scene.render.fps = ${fps}
bpy.context.scene.render.resolution_x = ${resolution.width}
bpy.context.scene.render.resolution_y = ${resolution.height}

# 清除現有序列
if bpy.context.scene.sequence_editor:
    bpy.context.scene.sequence_editor.sequences_all.clear()
else:
    bpy.context.scene.sequence_editor_create()

# 序列編輯器
seq_editor = bpy.context.scene.sequence_editor

# 當前時間軸位置
current_frame = 1

${generateVideoSequences(videoMappings, editingSuggestion, fps)}

${generateAudioPlaceholders(videoMappings.length)}

${editingSuggestion ? generateTransitions(videoMappings, editingSuggestion, fps) : ''}

${editingSuggestion ? generateEffects(videoMappings, editingSuggestion, fps) : ''}

# 設定預覽範圍
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = current_frame

print(f"✓ 剪輯完成！總計 {len(seq_editor.sequences_all)} 個片段")
print(f"✓ 總時長: {current_frame / ${fps}:.2f} 秒")
`;

    return script;
}


function generateVideoSequences(
    videoMappings: VideoMapping[],
    editingSuggestion?: EditingSuggestion,
    fps: number = 30
): string {
    let code = '\n# ===== 添加影片片段 =====\n';

    videoMappings.forEach((mapping) => {
        const { videoIndex, scene } = mapping;

        const sceneEditInfo = editingSuggestion?.scenes?.find(
            s => s.sceneId === scene.id
        );

        const inPoint = sceneEditInfo?.inPoint || 0;
        const outPoint = sceneEditInfo?.outPoint || scene.duration || 5;
        const duration = outPoint - inPoint;

        code += `
# 場景 ${scene.sceneNumber}: ${scene.description.substring(0, 100)}${scene.description.length > 100 ? '...' : ''}
video_${videoIndex} = seq_editor.sequences.new_movie(
    name="Scene_${scene.sceneNumber}",
    filepath="${scene.generatedVideo!.url.replace(/\\/g, '\\\\')}",
    channel=1,
    frame_start=current_frame
)
video_${videoIndex}.frame_offset_start = int(${inPoint} * ${fps})
video_${videoIndex}.frame_final_duration = int(${duration} * ${fps})

current_frame += int(${duration} * ${fps})
`;
    });

    return code;
}

function generateAudioPlaceholders(videoCount: number): string {
    if (videoCount === 0) return '';

    return `
# ===== 音頻處理 (需手動添加) =====
# ⚠️ 以下音頻需要手動添加到專案中：
# 1. 背景音樂 (BGM): 預設 channel 2
#    bgm = seq_editor.sequences.new_sound(
#        name="BGM",
#        filepath="/path/to/your/background_music.mp3",
#        channel=2,
#        frame_start=1
#    )
#
# 2. 旁白 (Voiceover): 預設 channel 3
#    vo = seq_editor.sequences.new_sound(
#        name="Voiceover",
#        filepath="/path/to/your/voiceover.mp3",
#        channel=3,
#        frame_start=1
#    )
#
# 3. 音效 (SFX): 預設 channel 4+
#    sfx_1 = seq_editor.sequences.new_sound(
#        name="SFX_MagneticSnap",
#        filepath="/path/to/magnetic_snap.wav",
#        channel=4,
#        frame_start=60  # 依實際需求調整時間點
#    )

`;
}

function generateTransitions(
    videoMappings: VideoMapping[],
    editingSuggestion: EditingSuggestion,
    fps: number
): string {
    let code = '\n# ===== 添加轉場效果 =====\n';

    editingSuggestion.scenes?.forEach((sceneEdit, editIndex) => {
        if (editIndex === 0 || !sceneEdit.transition) return;

        // 找到對應的影片索引
        const prevMapping = videoMappings.find(m =>
            editingSuggestion.scenes?.[editIndex - 1]?.sceneId === m.scene.id
        );
        const currMapping = videoMappings.find(m =>
            sceneEdit.sceneId === m.scene.id
        );

        // 如果找不到對應的影片，跳過
        if (!prevMapping || !currMapping) {
            code += `\n# ⚠️ 跳過轉場 ${editIndex}: 無法找到對應的影片片段\n`;
            return;
        }

        const transitionDuration = 0.5; // 0.5 秒轉場
        const transitionFrames = fps * transitionDuration;
        const blenderType = getBlenderTransitionType(sceneEdit.transition);

        code += `
# ${sceneEdit.transition} 轉場 (Scene ${prevMapping.scene.sceneNumber} → Scene ${currMapping.scene.sceneNumber})
try:
    transition_${editIndex} = seq_editor.sequences.new_effect(
        name="Transition_${editIndex}",
        type='${blenderType}',
        channel=10,
        frame_start=video_${currMapping.videoIndex}.frame_final_start - int(${transitionFrames}),
        frame_end=video_${currMapping.videoIndex}.frame_final_start,
        seq1=video_${prevMapping.videoIndex},
        seq2=video_${currMapping.videoIndex}
    )
except Exception as e:
    print(f"⚠ 無法添加轉場 ${editIndex}: {e}")
`;
    });

    return code;
}

function getBlenderTransitionType(transition: string): string {
    const mapping: Record<string, string> = {
        'crossfade': 'CROSS',
        'cross': 'CROSS',
        'dissolve': 'CROSS',
        'fade': 'CROSS',
        'wipe': 'WIPE',
        'cut': 'CROSS',  // Blender VSE 沒有純 CUT，用快速 CROSS 代替
    };
    return mapping[transition.toLowerCase()] || 'CROSS';
}

function generateEffects(
    videoMappings: VideoMapping[],
    editingSuggestion: EditingSuggestion,
    fps: number
): string {
    let code = '\n# ===== 添加視覺效果 =====\n';
    code += `# ⚠️ 注意：Blender VSE 的效果系統有限，某些 AI 建議的效果無法直接實現
# - 可實現: Color Correction (調色), Glow (發光), Blur (模糊), Transform (變換)
# - 需外部素材: Logo Overlay (Logo 疊加), Text Overlay (文字疊加) - 需載入圖片/文字檔
# - 無法實現: Sharpen (銳化), 3D Animation, Motion Graphics - 需進階節點或外部處理
\n`;

    editingSuggestion.scenes?.forEach((sceneEdit, editIndex) => {
        if (!sceneEdit.effects || sceneEdit.effects.length === 0) return;

        // 找到對應的影片
        const mapping = videoMappings.find(m => sceneEdit.sceneId === m.scene.id);
        if (!mapping) {
            code += `\n# ⚠️ 場景 ${editIndex}: 無對應影片，跳過效果\n`;
            return;
        }

        sceneEdit.effects.forEach((effect, effectIndex) => {
            const effectInfo = getBlenderEffectInfo(effect);

            if (!effectInfo.supported) {
                code += `\n# ⚠️ 效果 "${effect}" 無法在 Blender VSE 中實現 - ${effectInfo.reason}\n`;
                return;
            }

            code += `
# 場景 ${mapping.scene.sceneNumber} - ${effect} 效果
try:
    effect_${mapping.videoIndex}_${effectIndex} = seq_editor.sequences.new_effect(
        name="Effect_${effect}_${mapping.scene.sceneNumber}",
        type='${effectInfo.type}',
        channel=${20 + effectIndex},
        frame_start=video_${mapping.videoIndex}.frame_final_start,
        frame_end=video_${mapping.videoIndex}.frame_final_end,
        seq1=video_${mapping.videoIndex}
    )
    ${effectInfo.parameters.map(p => `${p}`).join('\n    ')}
except Exception as e:
    print(f"⚠ 無法添加效果 ${effect} 到場景 ${mapping.scene.sceneNumber}: {e}")
`;
        });
    });

    return code;
}

interface EffectInfo {
    supported: boolean;
    type: string;
    parameters: string[];
    reason?: string;
}

function getBlenderEffectInfo(effect: string): EffectInfo {
    const effectLower = effect.toLowerCase();

    // Color Correction (可實現)
    if (effectLower.includes('color') || effectLower.includes('correction') || effectLower.includes('grading')) {
        return {
            supported: true,
            type: 'COLOR',
            parameters: [
                'effect.color_saturation = 1.15',
                'effect.color_multiply = 1.05'
            ]
        };
    }

    // Glow (可實現)
    if (effectLower.includes('glow') || effectLower.includes('bloom') || effectLower.includes('light')) {
        return {
            supported: true,
            type: 'GLOW',
            parameters: [
                'effect.threshold = 0.6',
                'effect.clamp = 1.0',
                'effect.boost_factor = 0.5'
            ]
        };
    }

    // Blur (可實現)
    if (effectLower.includes('blur') || effectLower.includes('depth_of_field') || effectLower.includes('dof')) {
        return {
            supported: true,
            type: 'GAUSSIAN_BLUR',
            parameters: [
                'effect.size_x = 3.0',
                'effect.size_y = 3.0'
            ]
        };
    }

    // Transform/Zoom (可實現但需關鍵影格)
    if (effectLower.includes('zoom') || effectLower.includes('transform') || effectLower.includes('scale')) {
        return {
            supported: true,
            type: 'TRANSFORM',
            parameters: [
                '# ⚠️ 需手動設置關鍵影格來實現動畫效果',
                'effect.scale_x = 1.1',
                'effect.scale_y = 1.1'
            ]
        };
    }

    // 不支援的效果
    const unsupportedReasons: Record<string, string> = {
        'sharpen': '需使用節點編輯器或外部處理',
        '3d': '需在 3D 工作區處理',
        'animation': '需使用關鍵影格或外部處理',
        'motion_graphics': '需外部軟體 (After Effects, Motion)',
        'overlay': '需載入外部圖片/文字素材',
        'logo': '需載入外部圖片素材並使用 Alpha Over',
        'text': '需使用文字條 (Text Strip) 功能',
        'ui': '需外部軟體製作',
    };

    for (const [key, reason] of Object.entries(unsupportedReasons)) {
        if (effectLower.includes(key)) {
            return {
                supported: false,
                type: '',
                parameters: [],
                reason
            };
        }
    }

    // 預設：嘗試用 Glow (通用發光效果)
    return {
        supported: true,
        type: 'GLOW',
        parameters: [
            '# ⚠️ 未知效果類型，使用通用 Glow',
            'effect.threshold = 0.7'
        ]
    };
}

// 匯出為 .py 檔案
export function downloadBlenderScript(script: string, filename: string): void {
    const blob = new Blob([script], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
