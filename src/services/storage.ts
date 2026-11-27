import {
  DriveFolderLink,
  MarkdownDoc,
  MediaAsset,
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
  dryRunMode: 'dispatchmd_dry_run_v1',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
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

  loadDryRunMode: (fallback: boolean) => safeRead<boolean>(STORAGE_KEYS.dryRunMode, fallback),
  saveDryRunMode: (dryRun: boolean) => safeWrite(STORAGE_KEYS.dryRunMode, dryRun),
};
