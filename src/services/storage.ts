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
  SocialCredentialsMemory,
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
  creds: 'dispatchmd_connections_v1',
};

export const EMPTY_CREDENTIALS: SocialCredentialsMemory = {
  facebookPageId: '',
  facebookPageName: '',
  facebookPageToken: '',
  facebookAppId: '',
  instagramUserId: '',
  instagramUsername: '',
  twitterClientId: '',
  twitterHandle: '',
  twitterAccessToken: '',
  twitterCorsRelayUrl: '',
  webhookUrl: '',
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

const VALID_MODES = new Set<PlatformDispatchMode>([
  'dry-run',
  'official',
  'webhook',
  'composer',
  'skip',
]);

function normalizeCreds(
  raw: unknown,
  fallback: SocialCredentialsMemory = EMPTY_CREDENTIALS
): SocialCredentialsMemory {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const obj = raw as Record<string, unknown>;
  const str = (key: keyof SocialCredentialsMemory): string =>
    typeof obj[key] === 'string' ? (obj[key] as string) : fallback[key];
  return {
    facebookPageId: str('facebookPageId'),
    facebookPageName: str('facebookPageName'),
    facebookPageToken: str('facebookPageToken'),
    facebookAppId: str('facebookAppId'),
    instagramUserId: str('instagramUserId'),
    instagramUsername: str('instagramUsername'),
    twitterClientId: str('twitterClientId'),
    twitterHandle: str('twitterHandle'),
    twitterAccessToken: str('twitterAccessToken'),
    twitterCorsRelayUrl: str('twitterCorsRelayUrl'),
    webhookUrl: str('webhookUrl'),
  };
}

function normalizePlatformModes(
  raw: unknown,
  fallback: PlatformDispatchConfig
): PlatformDispatchConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const obj = raw as Partial<PlatformDispatchConfig>;
  return {
    facebook: VALID_MODES.has(obj.facebook as PlatformDispatchMode)
      ? (obj.facebook as PlatformDispatchMode)
      : fallback.facebook,
    instagram: VALID_MODES.has(obj.instagram as PlatformDispatchMode)
      ? (obj.instagram as PlatformDispatchMode)
      : fallback.instagram,
    twitter: VALID_MODES.has(obj.twitter as PlatformDispatchMode)
      ? (obj.twitter as PlatformDispatchMode)
      : fallback.twitter,
  };
}

export interface DispatchConfigBackup {
  format: 'dispatchmd-config-v1';
  exportedAt: string;
  creds: SocialCredentialsMemory;
  platformModes: PlatformDispatchConfig;
  schedule: ScheduleConfig;
  driveFolders: DriveFolderLink[];
  rules: SnipRule[];
}

export function buildConfigBackupPayload(data: {
  creds: SocialCredentialsMemory;
  platformModes: PlatformDispatchConfig;
  schedule: ScheduleConfig;
  driveFolders: DriveFolderLink[];
  rules: SnipRule[];
}): DispatchConfigBackup {
  return {
    format: 'dispatchmd-config-v1',
    exportedAt: new Date().toISOString(),
    creds: data.creds,
    platformModes: data.platformModes,
    schedule: data.schedule,
    driveFolders: data.driveFolders,
    rules: data.rules,
  };
}

export function parseConfigBackupJson(
  rawText: string,
  currentModes: PlatformDispatchConfig
): {
  creds?: SocialCredentialsMemory;
  platformModes?: PlatformDispatchConfig;
  schedule?: ScheduleConfig;
  driveFolders?: DriveFolderLink[];
  rules?: SnipRule[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON configuration must be an object.');
  }

  const obj = parsed as Record<string, unknown>;
  const hasWrappedCreds = obj.creds && typeof obj.creds === 'object' && !Array.isArray(obj.creds);
  const looksLikeFlatCreds =
    'facebookPageId' in obj ||
    'facebookPageToken' in obj ||
    'twitterAccessToken' in obj ||
    'webhookUrl' in obj;

  if (!hasWrappedCreds && !looksLikeFlatCreds && !obj.platformModes && !obj.schedule && !obj.rules) {
    throw new Error('This JSON file does not match a Dispatch.md configuration backup.');
  }

  const result: {
    creds?: SocialCredentialsMemory;
    platformModes?: PlatformDispatchConfig;
    schedule?: ScheduleConfig;
    driveFolders?: DriveFolderLink[];
    rules?: SnipRule[];
  } = {};

  if (hasWrappedCreds) {
    result.creds = normalizeCreds(obj.creds);
  } else if (looksLikeFlatCreds) {
    result.creds = normalizeCreds(obj);
  }

  if (obj.platformModes && typeof obj.platformModes === 'object') {
    result.platformModes = normalizePlatformModes(obj.platformModes, currentModes);
  }

  if (obj.schedule && typeof obj.schedule === 'object' && !Array.isArray(obj.schedule)) {
    result.schedule = obj.schedule as ScheduleConfig;
  }

  if (Array.isArray(obj.driveFolders)) {
    result.driveFolders = obj.driveFolders as DriveFolderLink[];
  }

  if (Array.isArray(obj.rules)) {
    result.rules = obj.rules as SnipRule[];
  }

  return result;
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
      media.filter((m) => m.source === 'sample' || !m.url.startsWith('blob:'))
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
    return normalizePlatformModes(raw, defaultFromLegacy);
  },
  savePlatformModes: (modes: PlatformDispatchConfig) =>
    safeWrite(STORAGE_KEYS.platformModes, modes),

  loadCreds: (fallback: SocialCredentialsMemory = EMPTY_CREDENTIALS): SocialCredentialsMemory => {
    const raw = safeRead<Partial<SocialCredentialsMemory>>(STORAGE_KEYS.creds, fallback);
    return normalizeCreds(raw, fallback);
  },
  saveCreds: (creds: SocialCredentialsMemory) => safeWrite(STORAGE_KEYS.creds, creds),
  clearCreds: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.creds);
    } catch {
      // Ignore storage removal errors
    }
  },
};
