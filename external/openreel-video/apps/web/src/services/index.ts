/**
 * Services index
 *
 * Exports all service modules for the web application.
 */

export {
  serviceWorkerManager,
  registerServiceWorker,
  isAIAvailable,
  type ServiceWorkerStatus,
  type CacheStatus,
} from "./service-worker";

export {
  autoSaveManager,
  initializeAutoSave,
  startAutoSave,
  stopAutoSave,
  markProjectDirty,
  checkForRecovery,
  recoverProject,
  type AutoSaveConfig,
  type AutoSaveMetadata,
} from "./auto-save";
