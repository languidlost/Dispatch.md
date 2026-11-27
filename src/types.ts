export type SocialPlatform = 'facebook' | 'instagram' | 'twitter';

export type WorkspaceTab = 'queue' | 'repository' | 'rules' | 'media' | 'connections';

export interface MarkdownDoc {
  id: string;
  title: string;
  filename: string;
  content: string;
  source: 'upload' | 'drive' | 'editor' | 'sample';
  driveFileId?: string;
  folderId?: string;
  updatedAt: string;
  selected: boolean;
}

export type SnipMode =
  | 'headings'
  | 'paragraphs'
  | 'hr'
  | 'blockquotes'
  | 'delimiter'
  | 'chunk';

export interface SnipRule {
  id: string;
  name: string;
  mode: SnipMode;
  headingLevel: 1 | 2 | 3;
  customDelimiter: string;
  stripFrontmatter: boolean;
  stripMarkdown: boolean;
  includeHeading: boolean;
  minChars: number;
  maxChars: number;
  targetLength: number;
  includeKeyword: string;
  excludeKeyword: string;
  appendText: string;
  autoPairImages: boolean;
  defaultPlatforms: SocialPlatform[];
  enabled: boolean;
}

export interface SnipCandidate {
  id: string;
  docId: string;
  docTitle: string;
  index: number;
  text: string;
  rawMarkdown: string;
  heading?: string;
  charCount: number;
  ruleId: string;
  ruleName: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  source: 'google-photos' | 'google-drive' | 'local' | 'sample';
  url: string;
  publicUrl?: string;
  mimeType: string;
  driveFileId?: string;
  folderId?: string;
  createdAt: string;
}

export interface PublishAttemptResult {
  ok: boolean;
  externalId?: string;
  permalink?: string;
  error?: string;
  timestamp: string;
  dryRun?: boolean;
  endpoint?: string;
}

export interface QueuePost {
  id: string;
  text: string;
  sourceDocId: string;
  sourceDocTitle: string;
  ruleName: string;
  platforms: SocialPlatform[];
  mediaId?: string;
  status: 'queued' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduledAt?: string;
  publishedAt?: string;
  order: number;
  results?: Partial<Record<SocialPlatform, PublishAttemptResult>>;
}

export interface ScheduleConfig {
  enabled: boolean;
  mode: 'interval' | 'times';
  intervalMinutes: number;
  dailyTimes: string[];
  activeWindowStart: string;
  activeWindowEnd: string;
  respectActiveWindow: boolean;
  lastAutoReleaseAt?: string;
  nextScheduledAt?: string;
}

export interface DriveFolderLink {
  id: string;
  folderId: string;
  name: string;
  purpose: 'markdown' | 'photos';
  url: string;
  lastSyncedAt?: string;
  itemCount: number;
}

export type DispatchMode = 'dry-run' | 'official' | 'webhook';

export interface SocialCredentialsMemory {
  facebookPageId: string;
  facebookPageName: string;
  facebookPageToken: string;
  facebookAppId: string;
  instagramUserId: string;
  instagramUsername: string;
  twitterClientId: string;
  twitterHandle: string;
  twitterAccessToken: string;
  twitterCorsRelayUrl: string;
  webhookUrl: string;
}
