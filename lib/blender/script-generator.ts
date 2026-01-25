import { EditingSuggestion } from '../types/project';
import type { Scene } from '../types/storyboard';

export interface BlenderScriptOptions {
    projectName: string;
    scenes: Scene[];
    editingSuggestion?: EditingSuggestion;
    fps?: number;
    resolution?: { width: number; height: number };
    transitionDuration?: number; // 轉場時長（秒）
    autoRender?: boolean; // 是否自動算圖
    outputPath?: string; // 輸出路徑（用於 headless 模式）
}

// 建立場景索引到影片索引的映射
interface VideoMapping {
    sceneIndex: number;
    videoIndex: number;
    scene: Scene;
}

/**
 * 生成 Blender 5.0+ 相容的 Python 腳本
 * 
 * Blender 5.0 API 重大變更：
 * 1. 媒體類型優先：必須先設定 media_type = 'VIDEO'，才能使用 FFMPEG 設定
 * 2. 序列存取：使用 sequences 集合（而非 strips）
 * 3. 轉場邏輯：前後片段需重疊，且應交錯放置在不同軌道
 * 4. 資源處理：VSE 不支援 URL，需先下載到本地
 * 5. Headless 模式：支援 blender --background 執行
 */
export function generateBlenderScript(options: BlenderScriptOptions): string {
    const {
        projectName,
        scenes,
        editingSuggestion,
        fps = 30,
        resolution = { width: 1920, height: 1080 },
        transitionDuration = 0.5,
        autoRender = false,
        outputPath = '',
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

    const transitionFrames = Math.round(transitionDuration * fps);
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_');

    const script = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Blender 5.0+ 自動剪輯腳本 (支援 Headless 模式)
專案: ${projectName}
生成時間: ${new Date().toISOString()}
影片片段數: ${videoMappings.length}

⚠️ 使用方式：

1. GUI 模式 (在 Blender 介面中執行):
   - 開啟 Blender → Scripting 面板 → 載入此腳本 → 執行

2. Headless 模式 (命令列執行):
   blender --background --python this_script.py -- --output /path/to/output.mp4

3. Headless + 自動算圖:
   blender --background --python this_script.py -- --output /path/to/output.mp4 --render

參數說明:
  --output PATH   指定輸出影片路徑 (必須在 -- 之後)
  --render        自動執行算圖
  --download-dir  指定影片下載目錄 (預設: 系統暫存)
"""

import bpy
import os
import sys
import urllib.request
import tempfile
import argparse
from pathlib import Path

# ===== 解析命令列參數 (Headless 模式) =====
def parse_args():
    """解析 Blender 傳入的命令列參數"""
    # 找到 '--' 之後的參數
    try:
        idx = sys.argv.index('--')
        script_args = sys.argv[idx + 1:]
    except ValueError:
        script_args = []
    
    parser = argparse.ArgumentParser(description='Blender VSE 自動剪輯腳本')
    parser.add_argument('--output', type=str, default='${outputPath || `${safeProjectName}_output.mp4`}',
                        help='輸出影片路徑')
    parser.add_argument('--render', action='store_true', default=${autoRender ? 'True' : 'False'},
                        help='自動執行算圖')
    parser.add_argument('--download-dir', type=str, default='',
                        help='影片下載目錄')
    
    return parser.parse_args(script_args)

ARGS = parse_args()

# ===== 配置 =====
FPS = ${fps}
RESOLUTION_X = ${resolution.width}
RESOLUTION_Y = ${resolution.height}
TRANSITION_FRAMES = ${transitionFrames}  # 轉場幀數 (${transitionDuration}秒)

# 下載目錄（優先使用命令列參數，其次使用系統暫存目錄）
if ARGS.download_dir:
    DOWNLOAD_DIR = Path(ARGS.download_dir)
else:
    DOWNLOAD_DIR = Path(tempfile.gettempdir()) / "blender_vse_temp"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ===== 工具函式 =====
def download_video(url: str, filename: str) -> str:
    """
    下載影片到本地
    VSE 不支援直接讀取 URL，必須先下載
    """
    local_path = DOWNLOAD_DIR / filename
    
    if local_path.exists():
        print(f"✓ 影片已存在: {local_path}")
        return str(local_path)
    
    print(f"⏳ 下載中: {url[:60]}...")
    try:
        urllib.request.urlretrieve(url, local_path)
        print(f"✓ 下載完成: {local_path}")
        return str(local_path)
    except Exception as e:
        print(f"❌ 下載失敗: {e}")
        return ""

def setup_scene():
    """設定場景基本參數"""
    scene = bpy.context.scene
    
    # 基本設定
    scene.render.fps = FPS
    scene.render.resolution_x = RESOLUTION_X
    scene.render.resolution_y = RESOLUTION_Y
    scene.render.resolution_percentage = 100
    
    # ⚠️ Blender 5.0 重要變更：
    # 必須先設定 media_type = 'VIDEO'，FFMPEG 才可用
    # file_format = 'FFMPEG' 已在 5.0 中移除！
    print("🔧 設定輸出格式...")
    try:
        # Blender 5.0+ 正確寫法
        scene.render.image_settings.media_type = 'VIDEO'
        
        # FFMPEG 編碼設定
        scene.render.ffmpeg.format = 'MPEG4'
        scene.render.ffmpeg.codec = 'H264'
        scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
        scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
        
        # 音頻設定
        scene.render.ffmpeg.audio_codec = 'AAC'
        scene.render.ffmpeg.audio_bitrate = 192
        scene.render.ffmpeg.audio_channels = 'STEREO'
        
        print("✓ 輸出格式: H.264 MP4 (AAC Audio)")
    except Exception as e:
        print(f"⚠ 輸出格式設定失敗: {e}")
        print("  嘗試使用備用設定...")
        # 備用：設定為 PNG 序列
        scene.render.image_settings.file_format = 'PNG'
    
    print(f"✓ 場景設定完成: {RESOLUTION_X}x{RESOLUTION_Y} @ {FPS}fps")

def setup_sequence_editor():
    """初始化序列編輯器"""
    scene = bpy.context.scene
    
    # 建立序列編輯器（如果不存在）
    if not scene.sequence_editor:
        scene.sequence_editor_create()
    
    seq_editor = scene.sequence_editor
    
    # 清除現有片段
    # Blender 5.0: 使用 strips 集合（非 sequences）
    if hasattr(seq_editor, 'strips'):
        for strip in list(seq_editor.strips):
            seq_editor.strips.remove(strip)
    elif hasattr(seq_editor, 'strips_all'):
        # 備用方案
        for strip in list(seq_editor.strips_all):
            try:
                seq_editor.strips.remove(strip)
            except:
                pass
    
    print("✓ 序列編輯器已初始化")
    return seq_editor

def add_movie_strip(seq_editor, filepath: str, name: str, channel: int, frame_start: int, in_point: float = 0, out_point: float = None):
    """
    添加影片片段
    
    Args:
        seq_editor: 序列編輯器
        filepath: 本地影片路徑
        name: 片段名稱
        channel: 軌道 (1 或 2，用於交錯)
        frame_start: 開始幀
        in_point: 入點（秒）
        out_point: 出點（秒），None 表示使用完整影片
    """
    if not os.path.exists(filepath):
        print(f"❌ 檔案不存在: {filepath}")
        return None
    
    try:
        # Blender 5.0: 使用 strips.new_movie（非 sequences）
        strip = seq_editor.strips.new_movie(
            name=name,
            filepath=filepath,
            channel=channel,
            frame_start=frame_start
        )
        
        # 設定入出點
        if in_point > 0:
            strip.frame_offset_start = int(in_point * FPS)
        
        if out_point is not None:
            duration = out_point - in_point
            strip.frame_final_duration = int(duration * FPS)
        
        print(f"✓ 添加影片: {name} (Channel {channel}, Frame {frame_start})")
        return strip
    except Exception as e:
        print(f"❌ 添加影片失敗 {name}: {e}")
        return None

def add_transition(seq_editor, strip1, strip2, channel: int = 10):
    """
    添加轉場效果 (Crossfade)
    
    ⚠️ Blender 5.0 轉場邏輯：
    前後片段必須在時間軸上有重疊 (Overlap)
    """
    if not strip1 or not strip2:
        print("⚠ 無法添加轉場: 缺少片段")
        return None
    
    try:
        # 計算重疊區域
        overlap_start = strip2.frame_final_start
        overlap_end = strip1.frame_final_end
        
        if overlap_start >= overlap_end:
            print("⚠ 片段沒有重疊，無法創建轉場")
            return None
        
        # 計算長度
        duration = overlap_end - overlap_start
        
        # 計算長度
        duration = overlap_end - overlap_start
        
        # Blender 5.0 new_effect 修正: ERROR said "length" must be keyword
        transition = seq_editor.strips.new_effect(
            name=f"Transition_{strip1.name}_to_{strip2.name}",
            type='CROSS',
            channel=channel,
            frame_start=overlap_start,
            length=duration, # 修正: 必須用 length 作為關鍵字
            input1=strip1,   # 修正: Blender 5.0 改用 input1
            input2=strip2    # 修正: Blender 5.0 改用 input2
        )
        print(f"✓ 添加轉場: {strip1.name} → {strip2.name}")
        return transition
    except Exception as e:
        print(f"⚠ 添加轉場失敗: {e}")
        return None

def add_color_effect(seq_editor, strip, saturation: float = 1.15, channel: int = 20):
    """添加調色效果"""
    if not strip:
        return None
    
    try:
        duration = strip.frame_final_end - strip.frame_final_start
        
        effect = seq_editor.strips.new_effect(
            name=f"Color_{strip.name}",
            type='COLOR',
            channel=channel,
            frame_start=strip.frame_final_start,
            length=duration,
            input1=strip # 修正: 改用 input1
        )
        
        # 設定飽和度
        if hasattr(effect, 'color_saturation'):
            effect.color_saturation = saturation
        if hasattr(effect, 'color_multiply'):
            effect.color_multiply = 1.05
        
        print(f"✓ 添加調色效果: {strip.name} (飽和度={saturation})")
        return effect
    except Exception as e:
        print(f"⚠ 添加調色效果失敗: {e}")
        return None

def add_glow_effect(seq_editor, strip, threshold: float = 0.6, channel: int = 21):
    """添加發光效果"""
    if not strip:
        return None
    
    try:
        duration = strip.frame_final_end - strip.frame_final_start
        
        effect = seq_editor.strips.new_effect(
            name=f"Glow_{strip.name}",
            type='GLOW',
            channel=channel,
            frame_start=strip.frame_final_start,
            length=duration,
            input1=strip # 修正: 改用 input1
        )
        
        if hasattr(effect, 'threshold'):
            effect.threshold = threshold
        if hasattr(effect, 'clamp'):
            effect.clamp = 1.0
        if hasattr(effect, 'boost_factor'):
            effect.boost_factor = 0.5
        
        print(f"✓ 添加發光效果: {strip.name} (閾值={threshold})")
        return effect
    except Exception as e:
        print(f"⚠ 添加發光效果失敗: {e}")
        return None

def add_blur_effect(seq_editor, strip, size: float = 3.0, channel: int = 22):
    """添加模糊效果"""
    if not strip:
        return None
    
    try:
        duration = strip.frame_final_end - strip.frame_final_start

        effect = seq_editor.strips.new_effect(
            name=f"Blur_{strip.name}",
            type='GAUSSIAN_BLUR',
            channel=channel,
            frame_start=strip.frame_final_start,
            length=duration,
            input1=strip # 修正: 改用 input1
        )
        
        if hasattr(effect, 'size_x'):
            effect.size_x = size
        if hasattr(effect, 'size_y'):
            effect.size_y = size
        
        print(f"✓ 添加模糊效果: {strip.name} (尺寸={size})")
        return effect
    except Exception as e:
        print(f"⚠ 添加模糊效果失敗: {e}")
        return None

def add_transform_effect(seq_editor, strip, scale: float = 1.1, channel: int = 23):
    """添加變換效果（縮放）"""
    if not strip:
        return None
    
    try:
        duration = strip.frame_final_end - strip.frame_final_start

        effect = seq_editor.strips.new_effect(
            name=f"Transform_{strip.name}",
            type='TRANSFORM',
            channel=channel,
            frame_start=strip.frame_final_start,
            length=duration,
            input1=strip # 修正: 改用 input1
        )
        
        if hasattr(effect, 'scale_x'):
            effect.scale_x = scale
        if hasattr(effect, 'scale_y'):
            effect.scale_y = scale
        
        print(f"✓ 添加變換效果: {strip.name} (縮放={scale})")
        return effect
    except Exception as e:
        print(f"⚠ 添加變換效果失敗: {e}")
        return None

def add_speed_effect(seq_editor, strip, speed_factor: float = 1.0, channel: int = 24):
    """添加速度效果（快慢動作）"""
    if not strip or speed_factor == 1.0:
        return None
    
    try:
        duration = strip.frame_final_end - strip.frame_final_start

        effect = seq_editor.strips.new_effect(
            name=f"Speed_{strip.name}",
            type='SPEED',
            channel=channel,
            frame_start=strip.frame_final_start,
            length=duration,
            input1=strip # 修正: 改用 input1
        )
        
        if hasattr(effect, 'speed_factor'):
            effect.speed_factor = speed_factor
        if hasattr(effect, 'use_as_speed'):
            effect.use_as_speed = True
        
        print(f"✓ 添加速度效果: {strip.name} (x{speed_factor})")
        return effect
    except Exception as e:
        print(f"⚠ 添加速度效果失敗: {e}")
        return None

def add_adjustment_layer(seq_editor, frame_start: int, frame_end: int, channel: int = 25):
    """添加調整圖層（全局色彩調整）"""
    try:
        duration = frame_end - frame_start
        
        # Adjustment Layer 使用不同的建構函式或參數？先嘗試標準 new_effect
        # 但 Adjustment Layer 其實沒有 seq1, seq2，但通常需要塞 None
        effect = seq_editor.strips.new_effect(
            name="Adjustment_Layer",
            type='ADJUSTMENT',
            channel=channel,
            frame_start=frame_start,
            length=duration
        )
        print(f"✓ 添加調整圖層: Frame {frame_start}-{frame_end}")
        return effect
    except Exception as e:
        print(f"⚠ 添加調整圖層失敗: {e}")
        return None

def add_gamma_cross_transition(seq_editor, strip1, strip2, channel: int = 10):
    """添加 Gamma 校正交叉溶解轉場（更自然的過渡）"""
    if not strip1 or not strip2:
        print("⚠ 無法添加轉場: 缺少片段")
        return None
    
    try:
        overlap_start = strip2.frame_final_start
        overlap_end = strip1.frame_final_end
        
        if overlap_start >= overlap_end:
            print("⚠ 片段沒有重疊，無法創建轉場")
            return None
        
        duration = overlap_end - overlap_start

        transition = seq_editor.strips.new_effect(
            name=f"GammaCross_{strip1.name}_to_{strip2.name}",
            type='GAMMA_CROSS',
            channel=channel,
            frame_start=overlap_start,
            length=duration,
            input1=strip1,
            input2=strip2
        )
        print(f"✓ 添加 Gamma Cross 轉場: {strip1.name} → {strip2.name}")
        return transition
    except Exception as e:
        print(f"⚠ 添加 Gamma Cross 轉場失敗: {e}")
        return None

# ===== 條帶修飾器 (Strip Modifiers) =====
def add_brightness_contrast_modifier(strip, brightness: float = 0.0, contrast: float = 1.0):
    """添加亮度/對比度修飾器"""
    if not strip:
        return None
    
    try:
        modifier = strip.modifiers.new(name="BrightnessContrast", type='BRIGHT_CONTRAST')
        modifier.bright = brightness
        modifier.contrast = contrast
        print(f"✓ 添加亮度/對比度修飾器: {strip.name}")
        return modifier
    except Exception as e:
        print(f"⚠ 添加亮度/對比度修飾器失敗: {e}")
        return None

def add_hue_saturation_modifier(strip, hue: float = 0.0, saturation: float = 1.0, value: float = 1.0):
    """添加色相/飽和度/明度修飾器"""
    if not strip:
        return None
    
    try:
        modifier = strip.modifiers.new(name="HueSaturation", type='HUE_CORRECT')
        # HUE_CORRECT 使用曲線，這裡用簡化設定
        if hasattr(modifier, 'color_saturation'):
            modifier.color_saturation = saturation
        print(f"✓ 添加色相/飽和度修飾器: {strip.name}")
        return modifier
    except Exception as e:
        print(f"⚠ 添加色相/飽和度修飾器失敗: {e}")
        return None

def add_curves_modifier(strip):
    """添加曲線調色修飾器（精細色彩分級）"""
    if not strip:
        return None
    
    try:
        modifier = strip.modifiers.new(name="Curves", type='CURVES')
        # 曲線預設為線性，用戶可在 UI 中手動調整
        print(f"✓ 添加曲線調色修飾器: {strip.name}")
        return modifier
    except Exception as e:
        print(f"⚠ 添加曲線調色修飾器失敗: {e}")
        return None

def add_white_balance_modifier(strip):
    """添加白平衡修飾器"""
    if not strip:
        return None
    
    try:
        modifier = strip.modifiers.new(name="WhiteBalance", type='WHITE_BALANCE')
        print(f"✓ 添加白平衡修飾器: {strip.name}")
        return modifier
    except Exception as e:
        print(f"⚠ 添加白平衡修飾器失敗: {e}")
        return None

def add_tonemap_modifier(strip):
    """添加色調映射修飾器（HDR 效果）"""
    if not strip:
        return None
    
    try:
        modifier = strip.modifiers.new(name="ToneMap", type='TONEMAP')
        print(f"✓ 添加色調映射修飾器: {strip.name}")
        return modifier
    except Exception as e:
        print(f"⚠ 添加色調映射修飾器失敗: {e}")
        return None

# ===== 主流程 =====
def main():
    print("=" * 50)
    print("Blender 5.0+ 自動剪輯腳本")
    print("=" * 50)
    
    # 設定場景
    setup_scene()
    
    # 初始化序列編輯器
    seq_editor = setup_sequence_editor()
    
    # 當前時間軸位置
    current_frame = 1
    
    # 存儲所有片段（用於轉場）
    strips = []
    
    # ===== 影片資料 =====
${generateVideoDataSection(videoMappings, editingSuggestion, fps, transitionFrames)}
    
    # ===== 下載並添加影片 =====
    print("\\n--- 下載影片 ---")
    for i, video_info in enumerate(VIDEO_DATA):
        # 判斷是 URL 還是本地路徑
        if video_info["url"].startswith("http"):
            filepath = download_video(video_info["url"], f"scene_{i+1}.mp4")
        else:
            filepath = video_info["url"]  # 已是本地路徑
        
        if not filepath:
            continue
        
        # 交錯軌道（Channel 1, 2 交替）
        channel = (i % 2) + 1
        
        # 計算開始幀（考慮重疊以支援轉場）
        if i == 0:
            frame_start = current_frame
        else:
            # 重疊：下一個片段提前 TRANSITION_FRAMES 幀開始
            frame_start = current_frame - TRANSITION_FRAMES
        
        strip = add_movie_strip(
            seq_editor,
            filepath=filepath,
            name=video_info["name"],
            channel=channel,
            frame_start=frame_start,
            in_point=video_info["in_point"],
            out_point=video_info["out_point"]
        )
        
        if strip:
            strips.append(strip)
            # 更新當前幀位置
            current_frame = strip.frame_final_end
${generateEffectsApplicationSection(videoMappings, editingSuggestion)}
    
    # ===== 添加轉場 =====
    print("\\n--- 添加轉場 ---")
    for i in range(1, len(strips)):
        add_transition(seq_editor, strips[i-1], strips[i], channel=10+i)
    
    # ===== 設定預覽範圍 =====
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = current_frame
    
    # 設定輸出路徑 (確保使用絕對路徑，解決無 Blend 檔時相對路徑問題)
    abs_output_path = os.path.abspath(ARGS.output)
    scene.render.filepath = abs_output_path
    
    print("\\n" + "=" * 50)
    print(f"✅ 剪輯完成！")
    print(f"   總片段數: {len(strips)}")
    print(f"   總時長: {current_frame / FPS:.2f} 秒")
    print(f"   輸出路徑: {scene.render.filepath}")
    print("=" * 50)
    
    # ===== 算圖 (根據參數決定) =====
    if ARGS.render:
        print("\\n🎬 開始算圖 (Headless 模式)...")
        print(f"   輸出至: {ARGS.output}")
        bpy.ops.render.render(animation=True)
        print("✅ 算圖完成！")
    else:
        print("\\n💡 提示: 使用 --render 參數可自動執行算圖")
        print("   範例: blender --background --python script.py -- --output output.mp4 --render")

# ===== 音頻處理建議 =====
"""
⚠️ 以下音頻需要手動添加到專案中：

1. 背景音樂 (BGM): 預設 Channel 5
   bgm = seq_editor.strips.new_sound(
       name="BGM",
       filepath="/path/to/background_music.mp3",
       channel=5,
       frame_start=1
   )

2. 旁白 (Voiceover): 預設 Channel 6
   vo = seq_editor.strips.new_sound(
       name="Voiceover",
       filepath="/path/to/voiceover.mp3",
       channel=6,
       frame_start=1
   )

3. 音效 (SFX): 預設 Channel 7+
   sfx = seq_editor.strips.new_sound(
       name="SFX_Impact",
       filepath="/path/to/impact.wav",
       channel=7,
       frame_start=60
   )
"""

if __name__ == "__main__":
    main()
`;

    return script;
}

/**
 * 生成影片資料區塊
 */
function generateVideoDataSection(
    videoMappings: VideoMapping[],
    editingSuggestion?: EditingSuggestion,
    fps: number = 30,
    transitionFrames: number = 15
): string {
    const videoDataItems = videoMappings.map((mapping) => {
        const { scene } = mapping;

        const sceneEditInfo = editingSuggestion?.scenes?.find(
            s => s.sceneId === scene.id
        );

        const inPoint = sceneEditInfo?.inPoint || 0;
        const outPoint = sceneEditInfo?.outPoint || scene.duration || 5;

        // 效果列表
        const effects = sceneEditInfo?.effects || [];
        // 修飾器列表 (Blender 5.0 新增)
        const modifiers = (sceneEditInfo as any)?.modifiers || [];
        // 速度因子
        const speedFactor = (sceneEditInfo as any)?.speedFactor || 1.0;

        return `        {
            "name": "Scene_${scene.sceneNumber}",
            "url": "${scene.generatedVideo!.url.replace(/\\/g, '\\\\')}",
            "in_point": ${inPoint},
            "out_point": ${outPoint},
            "effects": ${JSON.stringify(effects)},
            "modifiers": ${JSON.stringify(modifiers)},
            "speed_factor": ${speedFactor},
            "transition": "${sceneEditInfo?.transition || 'crossfade'}"
        }`;
    });

    return `    VIDEO_DATA = [
${videoDataItems.join(',\n')}
    ]`;
}

/**
 * 生成效果應用區塊
 */
function generateEffectsApplicationSection(
    videoMappings: VideoMapping[],
    editingSuggestion?: EditingSuggestion
): string {
    if (!editingSuggestion?.scenes) {
        return `            # 預設效果：調色 + 發光
            add_color_effect(seq_editor, strip, saturation=1.15, channel=20+i*3)
            add_glow_effect(seq_editor, strip, threshold=0.6, channel=21+i*3)`;
    }

    return `            # 根據 AI 建議添加效果條帶
            video_effects = video_info.get("effects", [])
            effect_channel = 20 + i * 6
            
            for effect in video_effects:
                effect_lower = effect.lower()
                if "color" in effect_lower:
                    add_color_effect(seq_editor, strip, saturation=1.15, channel=effect_channel)
                    effect_channel += 1
                elif "glow" in effect_lower or "bloom" in effect_lower:
                    add_glow_effect(seq_editor, strip, threshold=0.6, channel=effect_channel)
                    effect_channel += 1
                elif "blur" in effect_lower:
                    add_blur_effect(seq_editor, strip, size=3.0, channel=effect_channel)
                    effect_channel += 1
                elif "transform" in effect_lower or "zoom" in effect_lower:
                    add_transform_effect(seq_editor, strip, scale=1.1, channel=effect_channel)
                    effect_channel += 1
                elif "speed" in effect_lower:
                    speed_factor = video_info.get("speed_factor", 1.0)
                    add_speed_effect(seq_editor, strip, speed_factor=speed_factor, channel=effect_channel)
                    effect_channel += 1
                elif "multiply" in effect_lower:
                    # 乘法混合效果
                    pass  # 需要兩個輸入源
                elif "add" in effect_lower:
                    # 加法混合效果
                    pass  # 需要兩個輸入源
            
            # 根據 AI 建議添加條帶修飾器 (Blender 5.0)
            video_modifiers = video_info.get("modifiers", [])
            
            for modifier in video_modifiers:
                modifier_lower = modifier.lower()
                if "brightness" in modifier_lower or "contrast" in modifier_lower:
                    add_brightness_contrast_modifier(strip, brightness=0.05, contrast=1.1)
                elif "hue" in modifier_lower or "saturation" in modifier_lower:
                    add_hue_saturation_modifier(strip, saturation=1.15)
                elif "curves" in modifier_lower:
                    add_curves_modifier(strip)
                elif "white_balance" in modifier_lower or "white balance" in modifier_lower:
                    add_white_balance_modifier(strip)
                elif "tone" in modifier_lower or "tonemap" in modifier_lower:
                    add_tonemap_modifier(strip)`;
}

/**
 * 獲取 Blender 轉場類型
 */
export function getBlenderTransitionType(transition: string): string {
    const mapping: Record<string, string> = {
        'crossfade': 'CROSS',
        'cross': 'CROSS',
        'dissolve': 'CROSS',
        'fade': 'CROSS',
        'gamma_cross': 'GAMMA_CROSS',
        'wipe': 'WIPE',
        'cut': 'CROSS',  // Blender VSE 沒有純 CUT，用快速 CROSS 代替
    };
    return mapping[transition.toLowerCase()] || 'CROSS';
}

/**
 * 匯出為 .py 檔案
 */
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
