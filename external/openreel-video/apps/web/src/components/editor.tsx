import React, { useEffect } from "react";
import { Toolbar } from "./editor/Toolbar";
import { AssetsPanel } from "./editor/AssetsPanel";
import { Preview } from "./editor/Preview";
import { InspectorPanel } from "./editor/InspectorPanel";
import { Timeline } from "./editor/Timeline";
import { useProjectStore } from "../stores/project-store";
import { useTimelineStore } from "../stores/timeline-store";
import { useUIStore } from "../stores/ui-store";

/**
 * Keyboard shortcut handler hook
 */
const useKeyboardShortcuts = () => {
  const { undo, redo, canUndo, canRedo, splitClip } = useProjectStore();
  const { togglePlayback, seekRelative } = useTimelineStore();
  const { getSelectedClipIds, clearSelection } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      // Space - Play/Pause
      if (e.code === "Space" && !isMeta) {
        e.preventDefault();
        togglePlayback();
        return;
      }

      // Cmd/Ctrl + Z - Undo
      if (isMeta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z - Redo
      if (isMeta && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      // S - Split clip at playhead
      if (e.key === "s" && !isMeta) {
        const selectedClipIds = getSelectedClipIds();
        if (selectedClipIds.length === 1) {
          e.preventDefault();
          const { playheadPosition } = useTimelineStore.getState();
          splitClip(selectedClipIds[0], playheadPosition);
        }
        return;
      }

      // Delete/Backspace - Delete selected clips
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedClipIds = getSelectedClipIds();
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          // Delete clips
          const { removeClip } = useProjectStore.getState();
          selectedClipIds.forEach((id) => removeClip(id));
          clearSelection();
        }
        return;
      }

      // Escape - Clear selection
      if (e.key === "Escape") {
        clearSelection();
        return;
      }

      // Arrow keys - Seek
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekRelative(e.shiftKey ? -1 : -0.1);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        seekRelative(e.shiftKey ? 1 : 0.1);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    splitClip,
    togglePlayback,
    seekRelative,
    getSelectedClipIds,
    clearSelection,
  ]);
};

/**
 * Auto-save initialization hook
 */
const useAutoSave = () => {
  const { initializeAutoSave } = useProjectStore();

  useEffect(() => {
    initializeAutoSave().catch(console.error);
  }, [initializeAutoSave]);
};

/**
 * Main Editor Interface Component
 */
export const EditorInterface: React.FC = () => {
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize auto-save
  useAutoSave();

  // Resizable Timeline State
  const [timelineHeight, setTimelineHeight] = React.useState(280);
  const isDraggingRef = React.useRef(false);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const newHeight = window.innerHeight - e.clientY;
      // Clamp height between 200px and 60% of screen height
      const maxHeight = window.innerHeight * 0.6;
      setTimelineHeight(Math.max(200, Math.min(newHeight, maxHeight)));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden font-sans select-none relative z-20 text-xs text-text-secondary">
      {/* Main App Toolbar */}
      <Toolbar />

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT PANEL: Assets */}
        <AssetsPanel />

        {/* CENTER PANEL: Preview */}
        <Preview />

        {/* RIGHT PANEL: Inspector */}
        <InspectorPanel />
      </div>

      {/* Resizable Handle */}
      <div
        className="h-1 bg-border hover:bg-primary/50 cursor-row-resize transition-colors z-10 relative group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-x-0 -top-1 -bottom-1 bg-transparent" />
      </div>

      {/* BOTTOM PANEL: Timeline */}
      <div
        style={{ height: timelineHeight }}
        className="shrink-0 flex flex-col"
      >
        <Timeline />
      </div>
    </div>
  );
};

export default EditorInterface;
