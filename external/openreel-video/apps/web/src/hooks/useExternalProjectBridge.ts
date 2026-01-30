import { useEffect, useMemo, useRef } from "react";
import { createProjectSerializer, createStorageEngine } from "@openreel/core";
import { getTransitionBridge } from "../bridges/transition-bridge";
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

async function hydrateMediaItems(
  items: Array<{
    originalUrl?: string;
    blob: Blob | ArrayBuffer | Uint8Array | null;
    metadata: { fileSize: number };
    type?: "video" | "image" | "audio";
  }>,
) {
  const hydrated: typeof items = [];
  for (const item of items) {
    if (item.blob) {
      if (item.blob instanceof Blob) {
        hydrated.push(item);
        continue;
      }
      try {
        const blob = new Blob([item.blob], {
          type:
            item.type === "video"
              ? "video/mp4"
              : item.type === "image"
                ? "image/png"
                : "application/octet-stream",
        });
        hydrated.push({
          ...item,
          blob,
          isPlaceholder: false,
          metadata: {
            ...item.metadata,
            fileSize: blob.size,
          },
        });
        continue;
      } catch {
        hydrated.push({ ...item, blob: null });
        continue;
      }
    }

    if (!item.originalUrl) {
      hydrated.push(item);
      continue;
    }

    try {
      const response = await fetch(item.originalUrl);
      if (!response.ok) {
        hydrated.push({ ...item, blob: null, isPlaceholder: true });
        continue;
      }
      const contentType =
        response.headers.get("content-type") ||
        (item.type === "video"
          ? "video/mp4"
          : item.type === "image"
            ? "image/png"
            : "application/octet-stream");
      if (item.type === "video") {
        console.log(
          "[OpenReel Bridge] fetched",
          item.originalUrl,
          contentType,
        );
      }
      const normalizedType =
        item.type === "video"
          ? contentType.startsWith("video/")
            ? contentType
            : "video/mp4"
          : item.type === "image"
            ? contentType.startsWith("image/")
              ? contentType
              : "image/png"
            : contentType;
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: normalizedType });
      if (item.type === "video") {
        console.log(
          "[OpenReel Bridge] blob",
          blob.size,
          blob.type,
        );
      }

      if (!contentType || contentType.startsWith("text/")) {
        hydrated.push({ ...item, blob: null, isPlaceholder: true });
        continue;
      }

      hydrated.push({
        ...item,
        blob,
        isPlaceholder: false,
        metadata: {
          ...item.metadata,
          fileSize: blob.size,
        },
      });
    } catch {
      hydrated.push({ ...item, blob: null, isPlaceholder: true });
    }
  }
  return hydrated;
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

      if (data.type === "OPENREEL_IMPORT_PROJECT") {
        try {
          const parsedProjectFile = JSON.parse(
            data.payload.projectJson,
          ) as { project?: { mediaLibrary?: { items?: Array<{ id: string; originalUrl?: string; thumbnailUrl?: string }> } } };

          const { project: importedProject, validation } =
            serializer.importFromJsonWithValidation(data.payload.projectJson);

          if (!validation.valid || !importedProject) {
            event.source?.postMessage(
              {
                type: "OPENREEL_IMPORT_ERROR",
                payload: {
                  error: validation.errors.join("; ") || "Invalid project JSON",
                },
              },
              "*",
            );
            return;
          }

          const sourceItems = parsedProjectFile?.project?.mediaLibrary?.items || [];
          const patchedItems = importedProject.mediaLibrary.items.map((item) => {
            const source = sourceItems.find((sourceItem) => sourceItem.id === item.id);
            return {
              ...item,
              originalUrl: source?.originalUrl || item.originalUrl,
              thumbnailUrl: item.thumbnailUrl || source?.thumbnailUrl || null,
            };
          });

          const hydratedItems = await hydrateMediaItems(
            patchedItems as Array<{
              originalUrl?: string;
              blob: Blob | null;
              metadata: { fileSize: number };
            }>,
          );

          const normalizedProject = {
            ...importedProject,
            mediaLibrary: {
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
          event.source?.postMessage(
            { type: "OPENREEL_IMPORT_SUCCESS" },
            "*",
          );
        } catch (error) {
          event.source?.postMessage(
            {
              type: "OPENREEL_IMPORT_ERROR",
              payload: {
                error:
                  error instanceof Error
                    ? error.message
                    : "Import failed",
              },
            },
            "*",
          );
        }
      }

      if (data.type === "OPENREEL_REQUEST_EXPORT") {
        try {
          const currentProject = projectRef.current;
          const projectJson = serializer.exportToJsonWithMetadata(
            currentProject,
            `Exported from ${currentProject.name}`,
          );

          event.source?.postMessage(
            {
              type: "OPENREEL_EXPORT_PROJECT",
              payload: { projectJson },
            },
            "*",
          );
        } catch (error) {
          event.source?.postMessage(
            {
              type: "OPENREEL_EXPORT_PROJECT",
              payload: {
                projectJson: "",
              },
            },
            "*",
          );
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
