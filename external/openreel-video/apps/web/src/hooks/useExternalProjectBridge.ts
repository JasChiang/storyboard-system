import { useEffect, useMemo, useRef } from "react";
import { createProjectSerializer, createStorageEngine } from "@openreel/core";
import type { MediaItem, MediaMetadata, Project } from "@openreel/core";
import { getTransitionBridge } from "../bridges/transition-bridge";
import { loadMediaRecord, saveMediaBlob } from "../services/media-storage";
import { useProjectStore } from "../stores/project-store";
import { useUIStore } from "../stores/ui-store";

interface ImportMessage {
  type: "OPENREEL_IMPORT_PROJECT";
  payload: {
    projectJson: string;
  };
}

interface ExportRequestMessage {
  type: "OPENREEL_REQUEST_EXPORT";
}

type OpenReelMessage = ImportMessage | ExportRequestMessage;

type HydratableMediaItem = {
  [K in keyof Omit<MediaItem, "blob" | "metadata">]: Omit<
    MediaItem,
    "blob" | "metadata"
  >[K];
} & {
  originalUrl?: string;
  blob: Blob | ArrayBuffer | Uint8Array | null;
  metadata: MediaMetadata;
  [key: string]: unknown;
};

type ImportProgressPayload = {
  status: "processing" | "cached" | "downloading" | "complete";
  totalItems: number;
  processedItems: number;
  currentItemId: string;
  currentItemName: string;
  currentItemType: "video" | "image" | "audio";
  currentItemPercent: number | null;
  overallPercent: number;
  bytesLoaded?: number;
  bytesTotal?: number | null;
  fromCache?: boolean;
};

const EXTERNAL_IMPORT_CACHE_PROJECT_ID = "__openreel_external_import_cache_v1__";

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildCacheKey(item: HydratableMediaItem): string | null {
  if (!item.originalUrl) return null;
  return `external-media:${item.type}:${hashString(item.originalUrl)}`;
}

function defaultMimeType(type: "video" | "image" | "audio"): string {
  if (type === "video") return "video/mp4";
  if (type === "image") return "image/png";
  return "audio/mpeg";
}

function normalizeMimeType(
  type: "video" | "image" | "audio",
  contentType: string | null,
): string {
  const normalized = (contentType || "").toLowerCase();

  if (!normalized || normalized.includes("octet-stream")) {
    return defaultMimeType(type);
  }

  if (type === "video") {
    return normalized.startsWith("video/")
      ? contentType || "video/mp4"
      : defaultMimeType(type);
  }
  if (type === "image") {
    return normalized.startsWith("image/")
      ? contentType || "image/png"
      : defaultMimeType(type);
  }
  return normalized.startsWith("audio/")
    ? contentType || "audio/mpeg"
    : defaultMimeType(type);
}

function isLikelyInvalidContentType(contentType: string | null): boolean {
  const normalized = (contentType || "").toLowerCase();
  if (!normalized) return false;
  return (
    normalized.startsWith("text/") ||
    normalized.includes("json") ||
    normalized.includes("html") ||
    normalized.includes("xml")
  );
}

function isPlayableBlob(blob: Blob, type: "video" | "image" | "audio"): boolean {
  if (blob.size <= 0) return false;
  const normalized = (blob.type || "").toLowerCase();
  if (!normalized) return true;
  if (isLikelyInvalidContentType(normalized)) return false;

  if (type === "video") {
    return (
      normalized.startsWith("video/") || normalized.includes("octet-stream")
    );
  }
  if (type === "image") {
    return (
      normalized.startsWith("image/") || normalized.includes("octet-stream")
    );
  }
  return normalized.startsWith("audio/") || normalized.includes("octet-stream");
}

function normalizeExistingBlob(
  value: Blob | ArrayBuffer | Uint8Array | null,
  type: "video" | "image" | "audio",
): Blob | null {
  if (!value) return null;
  if (value instanceof Blob) return value;
  if (value instanceof ArrayBuffer) {
    return new Blob([value], { type: defaultMimeType(type) });
  }
  if (value instanceof Uint8Array) {
    const copied = new Uint8Array(value.byteLength);
    copied.set(value);
    return new Blob([copied.buffer], { type: defaultMimeType(type) });
  }
  return null;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function calcOverallPercent(
  processedItems: number,
  totalItems: number,
  currentItemRatio = 0,
): number {
  if (totalItems <= 0) return 100;
  return clampPercent(((processedItems + currentItemRatio) / totalItems) * 100);
}

async function downloadBlobWithProgress(
  url: string,
  type: "video" | "image" | "audio",
  onProgress: (bytesLoaded: number, bytesTotal: number | null) => void,
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (isLikelyInvalidContentType(contentType)) {
    throw new Error(`Unexpected content-type: ${contentType || "unknown"}`);
  }

  const lengthHeader = Number.parseInt(
    response.headers.get("content-length") || "",
    10,
  );
  const bytesTotal =
    Number.isFinite(lengthHeader) && lengthHeader > 0 ? lengthHeader : null;

  if (!response.body) {
    const blob = await response.blob();
    const fallbackBlob =
      blob.type === normalizeMimeType(type, contentType)
        ? blob
        : new Blob([await blob.arrayBuffer()], {
            type: normalizeMimeType(type, contentType),
          });
    onProgress(fallbackBlob.size, bytesTotal ?? fallbackBlob.size);
    if (!isPlayableBlob(fallbackBlob, type)) {
      throw new Error("Downloaded media is not playable");
    }
    return fallbackBlob;
  }

  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let bytesLoaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const copied = new Uint8Array(value.byteLength);
    copied.set(value);
    chunks.push(copied.buffer);
    bytesLoaded += copied.byteLength;
    onProgress(bytesLoaded, bytesTotal);
  }

  const blob = new Blob(chunks, { type: normalizeMimeType(type, contentType) });
  if (!isPlayableBlob(blob, type)) {
    throw new Error("Downloaded media is not playable");
  }
  return blob;
}

async function hydrateMediaItems(
  items: HydratableMediaItem[],
  reportProgress: (payload: ImportProgressPayload) => void,
) {
  const hydrated: MediaItem[] = [];
  const totalItems = items.length;
  let processedItems = 0;
  let failedItems = 0;

  for (const item of items) {
    reportProgress({
      status: "processing",
      totalItems,
      processedItems,
      currentItemId: item.id,
      currentItemName: item.name,
      currentItemType: item.type,
      currentItemPercent: 0,
      overallPercent: calcOverallPercent(processedItems, totalItems, 0),
      fromCache: false,
    });

    const existingBlob = normalizeExistingBlob(item.blob, item.type);
    if (existingBlob && isPlayableBlob(existingBlob, item.type)) {
      const updatedItem = {
        ...item,
        blob: existingBlob,
        isPlaceholder: false,
        metadata: {
          ...item.metadata,
          fileSize: existingBlob.size,
        },
      };
      hydrated.push(updatedItem);

      const cacheKey = buildCacheKey(item);
      if (cacheKey) {
        try {
          await saveMediaBlob(
            EXTERNAL_IMPORT_CACHE_PROJECT_ID,
            cacheKey,
            existingBlob,
            updatedItem.metadata,
          );
        } catch (error) {
          console.warn("[OpenReel Bridge] failed to persist media cache", error);
        }
      }

      processedItems += 1;
      reportProgress({
        status: "complete",
        totalItems,
        processedItems,
        currentItemId: item.id,
        currentItemName: item.name,
        currentItemType: item.type,
        currentItemPercent: 100,
        overallPercent: calcOverallPercent(processedItems, totalItems, 0),
        fromCache: false,
      });
      continue;
    }

    const cacheKey = buildCacheKey(item);
    if (cacheKey) {
      try {
        const cacheRecord = await loadMediaRecord(cacheKey);
        if (cacheRecord?.blob && isPlayableBlob(cacheRecord.blob, item.type)) {
          hydrated.push({
            ...item,
            blob: cacheRecord.blob,
            isPlaceholder: false,
            metadata: {
              ...item.metadata,
              fileSize: cacheRecord.blob.size,
            },
          });

          processedItems += 1;
          reportProgress({
            status: "cached",
            totalItems,
            processedItems,
            currentItemId: item.id,
            currentItemName: item.name,
            currentItemType: item.type,
            currentItemPercent: 100,
            overallPercent: calcOverallPercent(processedItems, totalItems, 0),
            fromCache: true,
          });
          continue;
        }
      } catch (error) {
        console.warn("[OpenReel Bridge] failed to read media cache", error);
      }
    }

    if (!item.originalUrl) {
      failedItems += 1;
      processedItems += 1;
      hydrated.push({
        ...item,
        blob: null,
        isPlaceholder: true,
      });
      reportProgress({
        status: "complete",
        totalItems,
        processedItems,
        currentItemId: item.id,
        currentItemName: item.name,
        currentItemType: item.type,
        currentItemPercent: 100,
        overallPercent: calcOverallPercent(processedItems, totalItems, 0),
        fromCache: false,
      });
      continue;
    }

    try {
      const blob = await downloadBlobWithProgress(
        item.originalUrl,
        item.type,
        (bytesLoaded, bytesTotal) => {
          const ratio =
            bytesTotal && bytesTotal > 0 ? bytesLoaded / bytesTotal : 0;
          reportProgress({
            status: "downloading",
            totalItems,
            processedItems,
            currentItemId: item.id,
            currentItemName: item.name,
            currentItemType: item.type,
            currentItemPercent:
              bytesTotal && bytesTotal > 0 ? clampPercent(ratio * 100) : null,
            overallPercent: calcOverallPercent(
              processedItems,
              totalItems,
              bytesTotal && bytesTotal > 0 ? ratio : 0,
            ),
            bytesLoaded,
            bytesTotal,
            fromCache: false,
          });
        },
      );

      const hydratedItem = {
        ...item,
        blob,
        isPlaceholder: false,
        metadata: {
          ...item.metadata,
          fileSize: blob.size,
        },
      };
      hydrated.push(hydratedItem);

      if (cacheKey) {
        try {
          await saveMediaBlob(
            EXTERNAL_IMPORT_CACHE_PROJECT_ID,
            cacheKey,
            blob,
            hydratedItem.metadata,
          );
        } catch (error) {
          console.warn("[OpenReel Bridge] failed to persist media cache", error);
        }
      }
    } catch (error) {
      failedItems += 1;
      console.warn("[OpenReel Bridge] failed to hydrate media", item.id, error);
      hydrated.push({ ...item, blob: null, isPlaceholder: true });
    }

    processedItems += 1;
    reportProgress({
      status: "complete",
      totalItems,
      processedItems,
      currentItemId: item.id,
      currentItemName: item.name,
      currentItemType: item.type,
      currentItemPercent: 100,
      overallPercent: calcOverallPercent(processedItems, totalItems, 0),
      fromCache: false,
    });
  }

  return { hydratedItems: hydrated, failedItems };
}

export function useExternalProjectBridge() {
  const loadProject = useProjectStore((state) => state.loadProject);
  const project = useProjectStore((state) => state.project);
  const setSkipWelcomeScreen = useUIStore((state) => state.setSkipWelcomeScreen);
  const projectRef = useRef(project);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const storage = useMemo(() => createStorageEngine(), []);
  const serializer = useMemo(() => createProjectSerializer(storage), [storage]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent<OpenReelMessage>) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      const sourceWindow = event.source as Window | null;
      const postToSource = (message: unknown) => {
        sourceWindow?.postMessage(message, "*");
      };

      if (data.type === "OPENREEL_IMPORT_PROJECT") {
        try {
          const parsedProjectFile = JSON.parse(
            data.payload.projectJson,
          ) as {
            project?: {
              mediaLibrary?: {
                items?: Array<{
                  id: string;
                  originalUrl?: string;
                  thumbnailUrl?: string;
                }>;
              };
            };
          };

          const { project: importedProject, validation } =
            serializer.importFromJsonWithValidation(data.payload.projectJson);

          if (!validation.valid || !importedProject) {
            postToSource({
              type: "OPENREEL_IMPORT_ERROR",
              payload: {
                error: validation.errors.join("; ") || "Invalid project JSON",
              },
            });
            return;
          }

          const sourceItems = parsedProjectFile?.project?.mediaLibrary?.items || [];
          const patchedItems = importedProject.mediaLibrary.items.map((item) => {
            const source = sourceItems.find(
              (sourceItem) => sourceItem.id === item.id,
            );
            return {
              ...item,
              originalUrl: source?.originalUrl || item.originalUrl,
              thumbnailUrl: item.thumbnailUrl || source?.thumbnailUrl || null,
            };
          });

          const { hydratedItems, failedItems } = await hydrateMediaItems(
            patchedItems as HydratableMediaItem[],
            (payload) => {
              postToSource({
                type: "OPENREEL_IMPORT_PROGRESS",
                payload,
              });
            },
          );

          const normalizedProject: Project = {
            ...importedProject,
            mediaLibrary: {
              ...importedProject.mediaLibrary,
              items: hydratedItems.map((item) => ({
                ...item,
                blob: item.blob ?? null,
                isPlaceholder: item.blob ? false : item.isPlaceholder ?? true,
              })),
            },
          };

          loadProject(normalizedProject);
          try {
            const transitionBridge = getTransitionBridge();
            transitionBridge.loadTransitionsFromProject(normalizedProject);
          } catch (error) {
            console.warn("[OpenReel Bridge] failed to hydrate transitions", error);
          }
          setSkipWelcomeScreen(true);
          if (
            !window.location.hash ||
            window.location.hash.startsWith("#/welcome")
          ) {
            window.location.hash = "#/editor";
          }
          postToSource({
            type: "OPENREEL_IMPORT_SUCCESS",
            payload: {
              totalItems: hydratedItems.length,
              failedItems,
            },
          });
        } catch (error) {
          postToSource({
            type: "OPENREEL_IMPORT_ERROR",
            payload: {
              error: error instanceof Error ? error.message : "Import failed",
            },
          });
        }
      }

      if (data.type === "OPENREEL_REQUEST_EXPORT") {
        try {
          const currentProject = projectRef.current;
          const projectJson = serializer.exportToJsonWithMetadata(
            currentProject,
            `Exported from ${currentProject.name}`,
          );

          postToSource({
            type: "OPENREEL_EXPORT_PROJECT",
            payload: { projectJson },
          });
        } catch (error) {
          postToSource({
            type: "OPENREEL_EXPORT_PROJECT",
            payload: {
              projectJson: "",
            },
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    window.parent?.postMessage({ type: "OPENREEL_READY" }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [loadProject, serializer]);
}
