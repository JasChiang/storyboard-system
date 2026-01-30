import { useEngineStore } from "../engine-store";

type EngineStoreState = ReturnType<typeof useEngineStore.getState>;

type EngineType<K extends keyof EngineStoreState> =
  EngineStoreState[K] extends () => infer T
    ? T extends Promise<infer U>
      ? NonNullable<U>
      : NonNullable<T>
    : never;

export function withEngine<T, R>(
  getEngine: () => T | null,
  engineName: string,
  operation: (engine: T) => R,
): R | null {
  const engine = getEngine();
  if (!engine) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`${engineName} not initialized`);
    }
    return null;
  }
  return operation(engine);
}

export async function withAsyncEngine<T, R>(
  getEngine: () => Promise<T>,
  _engineName: string,
  operation: (engine: T) => R | Promise<R>,
): Promise<R> {
  const engine = await getEngine();
  return operation(engine);
}

export function withTitleEngine<R>(
  operation: (engine: EngineType<"getTitleEngine">) => R,
): R | null {
  return withEngine(
    useEngineStore.getState().getTitleEngine,
    "TitleEngine",
    operation,
  );
}

export function withGraphicsEngine<R>(
  operation: (engine: EngineType<"getGraphicsEngine">) => R,
): R | null {
  return withEngine(
    useEngineStore.getState().getGraphicsEngine,
    "GraphicsEngine",
    operation,
  );
}

export async function withSubtitleEngine<R>(
  operation: (engine: EngineType<"getSubtitleEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getSubtitleEngine,
    "SubtitleEngine",
    operation,
  );
}

export function withVideoEngine<R>(
  operation: (engine: EngineType<"getVideoEngine">) => R,
): R | null {
  return withEngine(
    useEngineStore.getState().getVideoEngine,
    "VideoEngine",
    operation,
  );
}

export function withAudioEngine<R>(
  operation: (engine: EngineType<"getAudioEngine">) => R,
): R | null {
  return withEngine(
    useEngineStore.getState().getAudioEngine,
    "AudioEngine",
    operation,
  );
}

export function withPhotoEngine<R>(
  operation: (engine: EngineType<"getPhotoEngine">) => R,
): R | null {
  return withEngine(
    useEngineStore.getState().getPhotoEngine,
    "PhotoEngine",
    operation,
  );
}

export function withExportEngine<R>(
  operation: (engine: EngineType<"getExportEngine">) => R,
): R | null {
  return withEngine(
    useEngineStore.getState().getExportEngine,
    "ExportEngine",
    operation,
  );
}

export async function withMaskEngine<R>(
  operation: (engine: EngineType<"getMaskEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getMaskEngine,
    "MaskEngine",
    operation,
  );
}

export async function withChromaKeyEngine<R>(
  operation: (engine: EngineType<"getChromaKeyEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getChromaKeyEngine,
    "ChromaKeyEngine",
    operation,
  );
}

export async function withMultiCamEngine<R>(
  operation: (engine: EngineType<"getMultiCamEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getMultiCamEngine,
    "MultiCamEngine",
    operation,
  );
}

export async function withTemplateEngine<R>(
  operation: (engine: EngineType<"getTemplateEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getTemplateEngine,
    "TemplateEngine",
    operation,
  );
}

export async function withSoundLibraryEngine<R>(
  operation: (engine: EngineType<"getSoundLibraryEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getSoundLibraryEngine,
    "SoundLibraryEngine",
    operation,
  );
}

export async function withSpeechToTextEngine<R>(
  operation: (engine: EngineType<"getSpeechToTextEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getSpeechToTextEngine,
    "SpeechToTextEngine",
    operation,
  );
}

export async function withNestedSequenceEngine<R>(
  operation: (engine: EngineType<"getNestedSequenceEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getNestedSequenceEngine,
    "NestedSequenceEngine",
    operation,
  );
}

export async function withAdjustmentLayerEngine<R>(
  operation: (engine: EngineType<"getAdjustmentLayerEngine">) => R | Promise<R>,
): Promise<R> {
  return withAsyncEngine(
    useEngineStore.getState().getAdjustmentLayerEngine,
    "AdjustmentLayerEngine",
    operation,
  );
}
