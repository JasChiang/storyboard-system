import { EditingSuggestion } from '../types/project';
import type { Scene } from '../types/storyboard';

export interface BlenderScriptOptions {
    projectName: string;
    scenes: Scene[];
    editingSuggestion?: EditingSuggestion;
    fps?: number;
    resolution?: { width: number; height: number };
}

export function generateBlenderScript(options: BlenderScriptOptions): string {
    const {
        projectName,
        scenes,
        editingSuggestion,
        fps = 30,
        resolution = { width: 1920, height: 1080 },
    } = options;

    const script = `import bpy
import os

# Blender 自動剪輯腳本
# 專案: ${projectName}
# 生成時間: ${new Date().toISOString()}

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

${generateVideoSequences(scenes, editingSuggestion, fps)}

${editingSuggestion ? generateTransitions(editingSuggestion, fps) : ''}

${editingSuggestion ? generateEffects(editingSuggestion, fps) : ''}

# 設定預覽範圍
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = current_frame

print(f"✓ 剪輯完成！總計 {len(seq_editor.sequences_all)} 個片段")
print(f"✓ 總時長: {current_frame / ${fps}} 秒")
`;

    return script;
}

function generateVideoSequences(
    scenes: Scene[],
    editingSuggestion?: EditingSuggestion,
    fps: number = 30
): string {
    let code = '\n# ===== 添加影片片段 =====\n';

    scenes.forEach((scene, index) => {
        if (!scene.generatedVideo) return;

        const sceneEditInfo = editingSuggestion?.scenes?.find(
            s => s.sceneId === scene.id
        );

        const inPoint = sceneEditInfo?.inPoint || 0;
        const outPoint = sceneEditInfo?.outPoint || scene.duration || 5;
        const duration = outPoint - inPoint;

        code += `
# 場景 ${scene.sceneNumber}: ${scene.description}
video_${index} = seq_editor.sequences.new_movie(
    name="Scene_${scene.sceneNumber}",
    filepath="${scene.generatedVideo.url.replace(/\\/g, '\\\\')}",
    channel=1,
    frame_start=current_frame
)
video_${index}.frame_offset_start = int(${inPoint} * ${fps})
video_${index}.frame_final_duration = int(${duration} * ${fps})

# 添加對應的音頻（如果有）
if hasattr(video_${index}, 'sound'):
    audio_${index} = seq_editor.sequences.new_sound(
        name="Audio_${scene.sceneNumber}",
        filepath="${scene.generatedVideo.url.replace(/\\/g, '\\\\')}",
        channel=2,
        frame_start=current_frame
    )
    audio_${index}.frame_offset_start = int(${inPoint} * ${fps})
    audio_${index}.frame_final_duration = int(${duration} * ${fps})

current_frame += int(${duration} * ${fps})
`;
    });

    return code;
}

function generateTransitions(
    editingSuggestion: EditingSuggestion,
    fps: number
): string {
    let code = '\n# ===== 添加轉場效果 =====\n';

    editingSuggestion.scenes?.forEach((sceneEdit, index) => {
        if (index === 0 || !sceneEdit.transition) return;

        const transitionDuration = 0.5; // 0.5 秒轉場
        const transitionFrames = fps * transitionDuration;

        code += `
# ${sceneEdit.transition} 轉場
try:
    transition_${index} = seq_editor.sequences.new_effect(
        name="Transition_${index}",
        type='${getBlenderTransitionType(sceneEdit.transition)}',
        channel=3,
        frame_start=current_frame - int(${transitionFrames}),
        frame_end=current_frame,
        seq1=video_${index - 1},
        seq2=video_${index}
    )
except:
    print(f"⚠ 無法添加轉場 ${index}")
`;
    });

    return code;
}

function getBlenderTransitionType(transition: string): string {
    const mapping: Record<string, string> = {
        'crossfade': 'CROSS',
        'wipe': 'WIPE',
        'cut': 'CUT',
        'dissolve': 'CROSS',
    };
    return mapping[transition.toLowerCase()] || 'CROSS';
}

function generateEffects(
    editingSuggestion: EditingSuggestion,
    fps: number
): string {
    let code = '\n# ===== 添加視覺效果 =====\n';

    editingSuggestion.scenes?.forEach((sceneEdit, index) => {
        if (!sceneEdit.effects || sceneEdit.effects.length === 0) return;

        sceneEdit.effects.forEach((effect, effectIndex) => {
            code += `
# 場景 ${index} - ${effect} 效果
try:
    effect_${index}_${effectIndex} = seq_editor.sequences.new_effect(
        name="Effect_${effect}_${index}",
        type='${getBlenderEffectType(effect)}',
        channel=4 + ${effectIndex},
        frame_start=video_${index}.frame_final_start,
        frame_end=video_${index}.frame_final_end,
        seq1=video_${index}
    )
    ${getEffectParameters(effect, `effect_${index}_${effectIndex}`)}
except:
    print(f"⚠ 無法添加效果 ${effect} 到場景 ${index}")
`;
        });
    });

    return code;
}

function getBlenderEffectType(effect: string): string {
    const mapping: Record<string, string> = {
        'glow': 'GLOW',
        'blur': 'GAUSSIAN_BLUR',
        'color_correction': 'COLOR',
        'speed': 'SPEED',
        'transform': 'TRANSFORM',
    };
    return mapping[effect.toLowerCase()] || 'GLOW';
}

function getEffectParameters(effect: string, varName: string): string {
    const parameters: Record<string, string> = {
        'glow': `${varName}.threshold = 0.5
    ${varName}.clamp = 1.0`,
        'blur': `${varName}.size_x = 5
    ${varName}.size_y = 5`,
        'color_correction': `${varName}.color_saturation = 1.2
    ${varName}.color_multiply = 1.0`,
    };
    return parameters[effect.toLowerCase()] || '';
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
