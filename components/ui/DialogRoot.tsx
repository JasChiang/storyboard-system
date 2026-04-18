'use client';

/**
 * Single mount point for app-wide dialogs. Consumers register a dialog by
 * key and render function; opening is triggered by `useUiStore.openDialog`.
 *
 * This replaces the pattern of putting `isFooOpen` flags in many components
 * and lets any caller from anywhere open a named dialog in a single line:
 *
 *   const openDialog = useUiStore(s => s.openDialog);
 *   openDialog('character-create', { initialName: 'Alex' });
 *
 * Registering:
 *   registerDialog('character-create', ({ payload, close }) => (
 *     <CharacterCreateDialog initial={payload} onClose={close} />
 *   ));
 *
 * Keep registrations module-level (outside component render) or inside a
 * top-level layout effect so they persist for the whole session.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useUiStore } from '@/stores/ui-store';

export interface DialogContext<TPayload = unknown> {
  payload: TPayload;
  close: () => void;
}

type DialogRenderer<TPayload = unknown> = (ctx: DialogContext<TPayload>) => React.ReactNode;

const registry = new Map<string, DialogRenderer<unknown>>();
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

/** Register (or overwrite) a dialog renderer for a key. */
export function registerDialog<TPayload = unknown>(
  key: string,
  renderer: DialogRenderer<TPayload>
): () => void {
  registry.set(key, renderer as DialogRenderer<unknown>);
  notify();
  return () => {
    if (registry.get(key) === (renderer as DialogRenderer<unknown>)) {
      registry.delete(key);
      notify();
    }
  };
}

/** React hook for components that prefer to register inside JSX. */
export function useRegisterDialog<TPayload = unknown>(
  key: string,
  renderer: DialogRenderer<TPayload>
): void {
  useEffect(() => registerDialog(key, renderer), [key, renderer]);
}

function subscribeRegistry(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function snapshotRegistry() {
  return registry;
}

export function DialogRoot() {
  const dialog = useUiStore((s) => s.dialog);
  const close = useUiStore((s) => s.closeDialog);
  // re-render when registry changes
  useSyncExternalStore(subscribeRegistry, snapshotRegistry, snapshotRegistry);

  if (!dialog) return null;
  const renderer = registry.get(dialog.key);
  if (!renderer) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DialogRoot] No renderer registered for dialog key "${dialog.key}"`);
    }
    return null;
  }
  return <>{renderer({ payload: dialog.payload, close })}</>;
}
