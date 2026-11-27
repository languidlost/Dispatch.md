import {
  DispatchMode,
  DriveFolderLink,
  MarkdownDoc,
  MediaAsset,
  PlatformDispatchConfig,
  PlatformDispatchMode,
  QueuePost,
  ScheduleConfig,
  SnipRule,
} from '../types';

const STORAGE_KEYS = {
  docs: 'dispatchmd_docs_v1',
  rules: 'dispatchmd_rules_v1',
  queue: 'dispatchmd_queue_v1',
  schedule: 'dispatchmd_schedule_v1',
  driveFolders: 'dispatchmd_drive_folders_v1',
  localMedia: 'dispatchmd_local_media_v1',
  dispatchMode: 'dispatchmd_dispatch_mode_v1',
  platformModes: 'dispatchmd_platform_modes_v1',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return fallback;
    }
    if (
      typeof fallback === 'object' &&
      fallback !== null &&
      !Array.isArray(fallback) &&
      (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    ) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

const VALID_MODES = new Set<PlatformDispatchMode>(['dry-run', 'official', 'webhook', 'skip']);

export const workspaceStorage = {
  loadDocs: (fallback: MarkdownDoc[]) => safeRead<MarkdownDoc[]>(STORAGE_KEYS.docs, fallback),
  saveDocs: (docs: MarkdownDoc[]) => safeWrite(STORAGE_KEYS.docs, docs),

  loadRules: (fallback: SnipRule[]) => safeRead<SnipRule[]>(STORAGE_KEYS.rules, fallback),
  saveRules: (rules: SnipRule[]) => safeWrite(STORAGE_KEYS.rules, rules),

  loadQueue: (fallback: QueuePost[]) => safeRead<QueuePost[]>(STORAGE_KEYS.queue, fallback),
  saveQueue: (queue: QueuePost[]) => safeWrite(STORAGE_KEYS.queue, queue),

  loadSchedule: (fallback: ScheduleConfig) =>
    safeRead<ScheduleConfig>(STORAGE_KEYS.schedule, fallback),
  saveSchedule: (schedule: ScheduleConfig) => safeWrite(STORAGE_KEYS.schedule, schedule),

  loadDriveFolders: (fallback: DriveFolderLink[]) =>
    safeRead<DriveFolderLink[]>(STORAGE_KEYS.driveFolders, fallback),
  saveDriveFolders: (folders: DriveFolderLink[]) =>
    safeWrite(STORAGE_KEYS.driveFolders, folders),

  loadLocalMedia: (fallback: MediaAsset[]) =>
    safeRead<MediaAsset[]>(STORAGE_KEYS.localMedia, fallback),
  saveLocalMedia: (media: MediaAsset[]) =>
    safeWrite(
      STORAGE_KEYS.localMedia,
      media.filter((m) => m.source === 'sample' || (m.source === 'local' && !m.url.startsWith('blob:')))
    ),

  loadPlatformModes: (fallback: PlatformDispatchConfig): PlatformDispatchConfig => {
    const legacy = safeRead<string>(STORAGE_KEYS.dispatchMode, '');
    const legacyMode: DispatchMode | null =
      legacy === 'dry-run' || legacy === 'official' || legacy === 'webhook' ? legacy : null;
    const defaultFromLegacy: PlatformDispatchConfig = legacyMode
      ? { facebook: legacyMode, instagram: legacyMode, twitter: legacyMode }
      : fallback;

    const raw = safeRead<Partial<PlatformDispatchConfig>>(
      STORAGE_KEYS.platformModes,
      defaultFromLegacy
    );
    return {
      facebook: VALID_MODES.has(raw.facebook as PlatformDispatchMode)
        ? (raw.facebook as PlatformDispatchMode)
        : defaultFromLegacy.facebook,
      instagram: VALID_MODES.has(raw.instagram as PlatformDispatchMode)
        ? (raw.instagram as PlatformDispatchMode)
        : defaultFromLegacy.instagram,
      twitter: VALID_MODES.has(raw.twitter as PlatformDispatchMode)
        ? (raw.twitter as PlatformDispatchMode)
        : defaultFromLegacy.twitter,
    };
  },
  savePlatformModes: (modes: PlatformDispatchConfig) =>
    safeWrite(STORAGE_KEYS.platformModes, modes),
};
