/**
 * Global UI state store.
 *
 * Purpose: centralise cross-page UI concerns that were previously held in
 * scattered component-local state and passed via prop drilling:
 *   - selected scene id (referenced from several panels)
 *   - which panel is expanded (image / video / audio / export)
 *   - active dialog + arbitrary payload (replaces the 19 ad-hoc modal flags)
 *   - user preferences (view density, keyboard-shortcut sheet, dark mode intent)
 *
 * Dialogs are identified by a string key. Components register handlers with
 * the DialogRoot (see components/ui/DialogRoot) and `openDialog` / `closeDialog`
 * here set the active record.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type PanelId = 'storyboard' | 'image' | 'video' | 'audio' | 'export';
export type ViewDensity = 'comfortable' | 'compact';

export interface ActiveDialog {
  key: string;
  /** Arbitrary payload the dialog component will read. Keep serialisable. */
  payload?: unknown;
}

interface UiState {
  // Selection
  selectedSceneId: string | null;
  setSelectedSceneId: (id: string | null) => void;

  // Panel expand/collapse
  expandedPanel: PanelId | null;
  setExpandedPanel: (panel: PanelId | null) => void;
  togglePanel: (panel: PanelId) => void;

  // Dialog registry (one dialog at a time; stack-capable via `stack`)
  dialog: ActiveDialog | null;
  dialogStack: ActiveDialog[];
  openDialog: (key: string, payload?: unknown) => void;
  closeDialog: () => void;
  replaceDialog: (key: string, payload?: unknown) => void;

  // Preferences (persisted)
  viewDensity: ViewDensity;
  setViewDensity: (d: ViewDensity) => void;
  showShortcutSheet: boolean;
  toggleShortcutSheet: (next?: boolean) => void;

  // Async task hints (e.g. image generation running in the background)
  inflightTasks: Record<string, { label: string; startedAt: number }>;
  startTask: (id: string, label: string) => void;
  endTask: (id: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      selectedSceneId: null,
      setSelectedSceneId: (id) => set({ selectedSceneId: id }),

      expandedPanel: null,
      setExpandedPanel: (panel) => set({ expandedPanel: panel }),
      togglePanel: (panel) =>
        set((state) => ({ expandedPanel: state.expandedPanel === panel ? null : panel })),

      dialog: null,
      dialogStack: [],
      openDialog: (key, payload) => {
        const current = get().dialog;
        set({
          dialog: { key, payload },
          dialogStack: current ? [...get().dialogStack, current] : get().dialogStack,
        });
      },
      closeDialog: () => {
        const stack = get().dialogStack;
        if (stack.length > 0) {
          const next = stack[stack.length - 1]!;
          set({ dialog: next, dialogStack: stack.slice(0, -1) });
        } else {
          set({ dialog: null });
        }
      },
      replaceDialog: (key, payload) => set({ dialog: { key, payload } }),

      viewDensity: 'comfortable',
      setViewDensity: (d) => set({ viewDensity: d }),
      showShortcutSheet: false,
      toggleShortcutSheet: (next) =>
        set((state) => ({ showShortcutSheet: next ?? !state.showShortcutSheet })),

      inflightTasks: {},
      startTask: (id, label) =>
        set((state) => ({
          inflightTasks: { ...state.inflightTasks, [id]: { label, startedAt: Date.now() } },
        })),
      endTask: (id) =>
        set((state) => {
          const next = { ...state.inflightTasks };
          delete next[id];
          return { inflightTasks: next };
        }),
    }),
    {
      name: 'storyboard-ui',
      // Only persist durable preferences; never persist transient state.
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : ({
        getItem: () => null, setItem: () => {}, removeItem: () => {},
      } as unknown as Storage))),
      partialize: (state) => ({
        viewDensity: state.viewDensity,
        showShortcutSheet: state.showShortcutSheet,
      }),
    }
  )
);
