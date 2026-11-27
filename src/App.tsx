import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { X } from 'lucide-react';
import {
  DEFAULT_SCHEDULE_CONFIG,
  STARTER_DOCS,
  STARTER_MEDIA,
  STARTER_QUEUE,
  STARTER_RULES,
} from './data/starterContent';
import {
  DispatchMode,
  DriveFolderLink,
  MarkdownDoc,
  MediaAsset,
  QueuePost,
  ScheduleConfig,
  SnipCandidate,
  SnipRule,
  SocialCredentialsMemory,
  SocialPlatform,
  WorkspaceTab,
} from './types';
import {
  DriveFolderItem,
  getDriveFolderInfo,
  getGoogleAccessToken,
  initGoogleAuth,
  listGooglePhotosItems,
  listUserDriveFolders,
  parseDriveFolderId,
  signInWithGoogleDrive,
  signOutGoogle,
  syncImagesFromDriveFolder,
  syncMarkdownFromDriveFolder,
} from './services/googleAuth';
import { applySnipRule } from './services/snipEngine';
import {
  handleStaticOAuthCallbackIfPopup,
  publishToSocialPlatform,
} from './services/socialApis';
import { workspaceStorage } from './services/storage';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { QueueWorkspace } from './components/QueueWorkspace';
import { RepositoryView } from './components/RepositoryView';
import { SnipRulesView } from './components/SnipRulesView';
import { MediaDriveView } from './components/MediaDriveView';
import { ConnectionsView } from './components/ConnectionsView';
import { ConfirmReleaseModal } from './components/ConfirmReleaseModal';

function computeNextSlotDate(schedule: ScheduleConfig, now: Date): Date | null {
  if (!schedule.enabled) return null;

  if (schedule.mode === 'interval') {
    const base = schedule.lastAutoReleaseAt
      ? new Date(schedule.lastAutoReleaseAt).getTime()
      : now.getTime();
    const target = new Date(base + schedule.intervalMinutes * 60_000);
    return target;
  }

  if (schedule.dailyTimes.length === 0) return null;
  const sorted = [...schedule.dailyTimes].sort();
  for (const hhmm of sorted) {
    const [hh, mm] = hhmm.split(':').map(Number);
    const candidate = new Date(now);
    candidate.setHours(hh, mm, 0, 0);
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  const [firstH, firstM] = sorted[0].split(':').map(Number);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(firstH, firstM, 0, 0);
  return tomorrow;
}

function isWithinActiveWindow(schedule: ScheduleConfig, now: Date): boolean {
  if (!schedule.respectActiveWindow) return true;
  const [sh, sm] = schedule.activeWindowStart.split(':').map(Number);
  const [eh, em] = schedule.activeWindowEnd.split(':').map(Number);
  const curMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins <= endMins) {
    return curMins >= startMins && curMins <= endMins;
  }
  return curMins >= startMins || curMins <= endMins;
}

function formatCountdown(target: Date | null, now: Date, enabled: boolean): string {
  if (!enabled) return 'Paused';
  if (!target) return 'No slot';
  const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  // Handle popup OAuth returns cleanly for static GitHub Pages URLs
  useEffect(() => {
    handleStaticOAuthCallbackIfPopup();
  }, []);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('queue');
  const [docs, setDocs] = useState<MarkdownDoc[]>(() =>
    workspaceStorage.loadDocs(STARTER_DOCS)
  );
  const [rules, setRules] = useState<SnipRule[]>(() =>
    workspaceStorage.loadRules(STARTER_RULES)
  );
  const [queue, setQueue] = useState<QueuePost[]>(() =>
    workspaceStorage.loadQueue(STARTER_QUEUE)
  );
  const [schedule, setSchedule] = useState<ScheduleConfig>(() =>
    workspaceStorage.loadSchedule(DEFAULT_SCHEDULE_CONFIG)
  );
  const [driveFolders, setDriveFolders] = useState<DriveFolderLink[]>(() =>
    workspaceStorage.loadDriveFolders([])
  );
  const [mediaLibrary, setMediaLibrary] = useState<MediaAsset[]>(() =>
    workspaceStorage.loadLocalMedia(STARTER_MEDIA)
  );
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>(() =>
    workspaceStorage.loadDispatchMode('dry-run')
  );

  // Strict in-memory credentials (never persisted to localStorage)
  const [creds, setCreds] = useState<SocialCredentialsMemory>({
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
  });

  // Google Auth state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [availableDriveFolders, setAvailableDriveFolders] = useState<DriveFolderItem[]>([]);
  const [isSyncingFolderId, setIsSyncingFolderId] = useState<string | null>(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // Release & notification state
  const [confirmPost, setConfirmPost] = useState<QueuePost | null>(null);
  const [isReleasingId, setIsReleasingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());

  const lastSlotMinuteRef = useRef<string>('');
  const autoReleaseLockRef = useRef<boolean>(false);

  const notify = useCallback((text: string, type: 'info' | 'error' = 'info') => {
    setBanner({ text, type });
  }, []);

  // Persist non-sensitive workspace data
  useEffect(() => {
    workspaceStorage.saveDocs(docs);
  }, [docs]);
  useEffect(() => {
    workspaceStorage.saveRules(rules);
  }, [rules]);
  useEffect(() => {
    workspaceStorage.saveQueue(queue);
  }, [queue]);
  useEffect(() => {
    workspaceStorage.saveSchedule(schedule);
  }, [schedule]);
  useEffect(() => {
    workspaceStorage.saveDriveFolders(driveFolders);
  }, [driveFolders]);
  useEffect(() => {
    workspaceStorage.saveLocalMedia(mediaLibrary);
  }, [mediaLibrary]);
  useEffect(() => {
    workspaceStorage.saveDispatchMode(dispatchMode);
  }, [dispatchMode]);

  // Initialize Firebase Google Auth listener
  useEffect(() => {
    return initGoogleAuth(
      (user) => {
        setGoogleUser(user);
        setHasGoogleToken(Boolean(getGoogleAccessToken()));
      },
      (user) => {
        setGoogleUser(user);
        setHasGoogleToken(false);
      }
    );
  }, []);

  const sortedPending = useMemo(
    () =>
      [...queue]
        .filter((p) => p.status !== 'published')
        .sort((a, b) => a.order - b.order),
    [queue]
  );

  const executeSinglePostRelease = useCallback(
    async (post: QueuePost) => {
      if (autoReleaseLockRef.current) return;
      autoReleaseLockRef.current = true;
      setIsReleasingId(post.id);

      try {
        const media = post.mediaId
          ? mediaLibrary.find((m) => m.id === post.mediaId)
          : undefined;
        const results: Partial<Record<SocialPlatform, Awaited<ReturnType<typeof publishToSocialPlatform>>>> = {};

        for (const platform of post.platforms) {
          results[platform] = await publishToSocialPlatform(platform, post.text, creds, {
            dispatchMode,
            media,
            sourceDocTitle: post.sourceDocTitle,
          });
        }

        const allOk = Object.values(results).every((r) => r?.ok);
        setQueue((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  status: allOk ? 'published' : 'failed',
                  publishedAt: allOk ? new Date().toISOString() : item.publishedAt,
                  results,
                }
              : item
          )
        );

        if (allOk) {
          notify(
            dispatchMode === 'dry-run'
              ? `Simulated release of post from ${post.sourceDocTitle}.md to ${post.platforms.join(', ')}.`
              : dispatchMode === 'webhook'
                ? `Dispatched post from ${post.sourceDocTitle}.md via Webhook Bridge.`
                : `Published post from ${post.sourceDocTitle}.md to ${post.platforms.join(', ')}.`
          );
        } else {
          const firstErr = Object.values(results).find((r) => !r?.ok)?.error;
          notify(firstErr || 'One or more social platforms returned an error.', 'error');
        }
      } finally {
        setIsReleasingId(null);
        autoReleaseLockRef.current = false;
      }
    },
    [creds, dispatchMode, mediaLibrary, notify]
  );

  // Live clock + automated interval / scheduled-time release loop
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      setNowTick(now);

      if (autoReleaseLockRef.current) return;

      // 1. Check per-post explicit scheduledAt timestamps first
      const dueSpecific = sortedPending.find(
        (p) => p.scheduledAt && new Date(p.scheduledAt).getTime() <= now.getTime()
      );
      if (dueSpecific) {
        void executeSinglePostRelease(dueSpecific);
        return;
      }

      // 2. Check global Auto-Release scheduler
      if (!schedule.enabled || sortedPending.length === 0) return;
      if (!isWithinActiveWindow(schedule, now)) return;

      const nextHead = sortedPending[0];
      if (!nextHead) return;

      if (schedule.mode === 'interval') {
        const lastMs = schedule.lastAutoReleaseAt
          ? new Date(schedule.lastAutoReleaseAt).getTime()
          : 0;
        if (lastMs === 0) {
          // Initialize anchor when first enabled so countdown begins cleanly
          setSchedule((prev) => ({
            ...prev,
            lastAutoReleaseAt: now.toISOString(),
          }));
          return;
        }
        if (now.getTime() - lastMs >= schedule.intervalMinutes * 60_000) {
          setSchedule((prev) => ({
            ...prev,
            lastAutoReleaseAt: now.toISOString(),
          }));
          void executeSinglePostRelease(nextHead);
        }
      } else {
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`;
        const slotKey = `${now.toDateString()}-${hhmm}`;
        if (schedule.dailyTimes.includes(hhmm) && lastSlotMinuteRef.current !== slotKey) {
          lastSlotMinuteRef.current = slotKey;
          setSchedule((prev) => ({
            ...prev,
            lastAutoReleaseAt: now.toISOString(),
          }));
          void executeSinglePostRelease(nextHead);
        }
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [schedule, sortedPending, executeSinglePostRelease]);

  const nextTargetDate = useMemo(
    () => computeNextSlotDate(schedule, nowTick),
    [schedule, nowTick]
  );

  const countdownText = useMemo(
    () => formatCountdown(nextTargetDate, nowTick, schedule.enabled),
    [nextTargetDate, nowTick, schedule.enabled]
  );

  // Enqueue extracted snippets with optional auto-image pairing
  const enqueueSnippets = useCallback(
    (candidates: SnipCandidate[], rule: SnipRule) => {
      if (candidates.length === 0) return;
      setQueue((prev) => {
        const maxOrder = prev.reduce((m, item) => Math.max(m, item.order), -1);
        const added: QueuePost[] = candidates.map((c, idx) => {
          const pairedMedia =
            rule.autoPairImages && mediaLibrary.length > 0
              ? mediaLibrary[(prev.length + idx) % mediaLibrary.length]
              : undefined;
          return {
            id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: c.text,
            sourceDocId: c.docId,
            sourceDocTitle: c.docTitle,
            ruleName: rule.name,
            platforms: rule.defaultPlatforms.length > 0 ? rule.defaultPlatforms : ['twitter'],
            mediaId: pairedMedia?.id,
            status: 'queued',
            order: maxOrder + 1 + idx,
          };
        });
        return [...prev, ...added];
      });
      notify(`Added ${candidates.length} snipped post(s) to the publishing queue.`);
    },
    [mediaLibrary, notify]
  );

  const handleUploadMarkdownFiles = async (files: FileList) => {
    const newDocs: MarkdownDoc[] = [];
    for (const file of Array.from(files)) {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
      newDocs.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        filename: file.name,
        content,
        source: 'upload',
        updatedAt: new Date().toISOString(),
        selected: true,
      });
    }
    if (newDocs.length > 0) {
      setDocs((prev) => [...newDocs, ...prev]);
      notify(`Uploaded ${newDocs.length} Markdown file(s) to your repository.`);
    }
  };

  const handleSnipSelectedToQueue = () => {
    const selectedDocs = docs.filter((d) => d.selected);
    const activeRules = rules.filter((r) => r.enabled);
    if (selectedDocs.length === 0 || activeRules.length === 0) {
      notify('Select at least one Markdown file and enable one snipping rule.', 'error');
      return;
    }

    let totalQueued = 0;
    for (const rule of activeRules) {
      const candidates = selectedDocs.flatMap((doc) => applySnipRule(doc, rule));
      if (candidates.length > 0) {
        enqueueSnippets(candidates, rule);
        totalQueued += candidates.length;
      }
    }

    if (totalQueued === 0) {
      notify('No snippets matched your active rules on the selected files.', 'error');
    } else {
      setActiveTab('queue');
    }
  };

  const handleMovePost = (id: string, direction: 'up' | 'down') => {
    setQueue((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((p) => p.id === id);
      if (index === -1) return prev;
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return prev;
      const tempOrder = sorted[index].order;
      sorted[index] = { ...sorted[index], order: sorted[swapIndex].order };
      sorted[swapIndex] = { ...sorted[swapIndex], order: tempOrder };
      return sorted;
    });
  };

  // Google Sign-In & Drive / Photos Actions
  const handleGoogleLogin = async () => {
    setIsSigningInGoogle(true);
    try {
      const { user } = await signInWithGoogleDrive();
      setGoogleUser(user);
      setHasGoogleToken(true);
      notify(`Signed in with Google as ${user.email}.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Google sign-in failed.', 'error');
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleGoogleLogout = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    setHasGoogleToken(false);
    setAvailableDriveFolders([]);
    notify('Signed out of Google.');
  };

  const handleLinkDriveFolder = async (
    folderIdOrUrl: string,
    purpose: 'markdown' | 'photos'
  ) => {
    const folderId = parseDriveFolderId(folderIdOrUrl);
    if (!folderId) {
      notify('Enter a valid Google Drive folder URL or ID.', 'error');
      return;
    }

    let name = `Drive Folder (${folderId.slice(0, 6)}…)`;
    const token = getGoogleAccessToken();
    if (token) {
      try {
        const info = await getDriveFolderInfo(folderId, token);
        name = info.name;
      } catch {
        // Keep fallback name if metadata lookup fails
      }
    }

    const newLink: DriveFolderLink = {
      id: `df-${Date.now()}`,
      folderId,
      name,
      purpose,
      url: `https://drive.google.com/drive/folders/${folderId}`,
      itemCount: 0,
    };
    setDriveFolders((prev) => [newLink, ...prev]);
    notify(`Linked Google Drive folder "${name}".`);
  };

  const handleSyncDriveFolder = async (folder: DriveFolderLink) => {
    const token = getGoogleAccessToken();
    if (!token) {
      notify('Sign in with Google first to sync Drive folders.', 'error');
      return;
    }
    setIsSyncingFolderId(folder.id);
    try {
      if (folder.purpose === 'markdown') {
        const syncedDocs = await syncMarkdownFromDriveFolder(folder.folderId, token);
        setDocs((prev) => {
          const existingIds = new Set(syncedDocs.map((d) => d.id));
          return [...syncedDocs, ...prev.filter((d) => !existingIds.has(d.id))];
        });
        setDriveFolders((prev) =>
          prev.map((f) =>
            f.id === folder.id
              ? { ...f, lastSyncedAt: new Date().toISOString(), itemCount: syncedDocs.length }
              : f
          )
        );
        notify(`Synced ${syncedDocs.length} Markdown file(s) from "${folder.name}".`);
      } else {
        const syncedImages = await syncImagesFromDriveFolder(folder.folderId, token);
        setMediaLibrary((prev) => {
          const existingIds = new Set(syncedImages.map((m) => m.id));
          return [...syncedImages, ...prev.filter((m) => !existingIds.has(m.id))];
        });
        setDriveFolders((prev) =>
          prev.map((f) =>
            f.id === folder.id
              ? { ...f, lastSyncedAt: new Date().toISOString(), itemCount: syncedImages.length }
              : f
          )
        );
        notify(`Synced ${syncedImages.length} photo(s) from "${folder.name}".`);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Drive sync failed.', 'error');
    } finally {
      setIsSyncingFolderId(null);
    }
  };

  const handleFetchDriveFolders = async () => {
    const token = getGoogleAccessToken();
    if (!token) return;
    try {
      const folders = await listUserDriveFolders(token);
      setAvailableDriveFolders(folders);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to list Drive folders.', 'error');
    }
  };

  const handleLoadGooglePhotos = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      notify('Sign in with Google first.', 'error');
      return;
    }
    setIsLoadingPhotos(true);
    try {
      const photos = await listGooglePhotosItems(token);
      setMediaLibrary((prev) => {
        const existingIds = new Set(photos.map((p) => p.id));
        return [...photos, ...prev.filter((p) => !existingIds.has(p.id))];
      });
      notify(`Loaded ${photos.length} image(s) from Google Photos / Drive.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to fetch Google Photos.', 'error');
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleUploadLocalImages = (files: FileList) => {
    const assets: MediaAsset[] = Array.from(files).map((file) => ({
      id: `local-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      source: 'local',
      url: URL.createObjectURL(file),
      mimeType: file.type || 'image/jpeg',
      createdAt: new Date().toISOString(),
    }));
    setMediaLibrary((prev) => [...assets, ...prev]);
    notify(`Added ${assets.length} local photo(s) to media library.`);
  };

  const handleReleaseHeadClick = () => {
    if (sortedPending.length === 0) return;
    setConfirmPost(sortedPending[0]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onReleaseNext={handleReleaseHeadClick}
        pendingCount={sortedPending.length}
        isReleasing={Boolean(isReleasingId)}
      />

      <div className="flex-1 flex flex-col lg:flex-row">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          schedule={schedule}
          onUpdateSchedule={(next) =>
            setSchedule({
              ...next,
              lastAutoReleaseAt:
                next.enabled && !schedule.enabled
                  ? new Date().toISOString()
                  : next.lastAutoReleaseAt,
            })
          }
          countdownText={countdownText}
          stats={{
            docsCount: docs.length,
            queuedCount: sortedPending.length,
            publishedCount: queue.filter((p) => p.status === 'published').length,
            mediaCount: mediaLibrary.length,
          }}
          connectedSummary={{
            google: hasGoogleToken,
            facebook: Boolean(creds.facebookPageId && creds.facebookPageToken),
            instagram: Boolean(creds.instagramUserId && creds.facebookPageToken),
            twitter: Boolean(creds.twitterAccessToken),
          }}
          dispatchMode={dispatchMode}
        />

        <main className="flex-1 p-5 sm:p-8 max-w-6xl w-full mx-auto">
          {banner && (
            <div
              role="status"
              className={`mb-6 px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-4 ${
                banner.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                aria-label="Dismiss notification"
                className="text-current opacity-60 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'queue' && (
            <QueueWorkspace
              queue={queue}
              mediaLibrary={mediaLibrary}
              creds={creds}
              dispatchMode={dispatchMode}
              isReleasingId={isReleasingId}
              onUpdatePost={(id, patch) =>
                setQueue((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
              }
              onMovePost={handleMovePost}
              onDeletePost={(id) =>
                setQueue((prev) => prev.filter((p) => p.id !== id))
              }
              onRequestRelease={(post) => setConfirmPost(post)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'repository' && (
            <RepositoryView
              docs={docs}
              onUploadFiles={handleUploadMarkdownFiles}
              onAddDoc={(title, content) =>
                setDocs((prev) => [
                  {
                    id: `doc-${Date.now()}`,
                    title,
                    filename: title.endsWith('.md') ? title : `${title}.md`,
                    content,
                    source: 'editor',
                    updatedAt: new Date().toISOString(),
                    selected: true,
                  },
                  ...prev,
                ])
              }
              onUpdateDoc={(id, patch) =>
                setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
              }
              onDeleteDoc={(id) => setDocs((prev) => prev.filter((d) => d.id !== id))}
              onSnipSelectedToQueue={handleSnipSelectedToQueue}
              onNavigateMedia={() => setActiveTab('media')}
            />
          )}

          {activeTab === 'rules' && (
            <SnipRulesView
              docs={docs}
              rules={rules}
              onAddRule={() =>
                setRules((prev) => [
                  ...prev,
                  {
                    id: `rule-${Date.now()}`,
                    name: `Custom Rule ${prev.length + 1}`,
                    mode: 'paragraphs',
                    headingLevel: 2,
                    customDelimiter: '<!-- post -->',
                    stripFrontmatter: true,
                    stripMarkdown: true,
                    includeHeading: true,
                    minChars: 20,
                    maxChars: 280,
                    targetLength: 240,
                    includeKeyword: '',
                    excludeKeyword: '',
                    appendText: '',
                    autoPairImages: false,
                    defaultPlatforms: ['twitter'],
                    enabled: true,
                  },
                ])
              }
              onUpdateRule={(id, patch) =>
                setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
              }
              onDeleteRule={(id) => setRules((prev) => prev.filter((r) => r.id !== id))}
              onQueueCandidates={enqueueSnippets}
            />
          )}

          {activeTab === 'media' && (
            <MediaDriveView
              googleUser={googleUser}
              hasGoogleToken={hasGoogleToken}
              isSigningIn={isSigningInGoogle}
              onGoogleLogin={handleGoogleLogin}
              onGoogleLogout={handleGoogleLogout}
              driveFolders={driveFolders}
              availableDriveFolders={availableDriveFolders}
              isSyncingFolderId={isSyncingFolderId}
              isLoadingPhotos={isLoadingPhotos}
              mediaLibrary={mediaLibrary}
              onLinkDriveFolder={handleLinkDriveFolder}
              onSyncDriveFolder={handleSyncDriveFolder}
              onRemoveDriveFolder={(id) =>
                setDriveFolders((prev) => prev.filter((f) => f.id !== id))
              }
              onFetchDriveFolderList={handleFetchDriveFolders}
              onLoadGooglePhotos={handleLoadGooglePhotos}
              onUploadLocalImages={handleUploadLocalImages}
              onUpdateMediaPublicUrl={(id, publicUrl) =>
                setMediaLibrary((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, publicUrl } : m))
                )
              }
              onDeleteMedia={(id) =>
                setMediaLibrary((prev) => prev.filter((m) => m.id !== id))
              }
              onCreatePostWithMedia={(media) => {
                setQueue((prev) => {
                  const maxOrder = prev.reduce((m, item) => Math.max(m, item.order), -1);
                  return [
                    ...prev,
                    {
                      id: `q-img-${Date.now()}`,
                      text: `Shared photo: ${media.name.replace(/\.[^.]+$/, '')}`,
                      sourceDocId: 'media-direct',
                      sourceDocTitle: 'Photo_Attachment',
                      ruleName: 'Direct Photo Post',
                      platforms: ['facebook', 'instagram'],
                      mediaId: media.id,
                      status: 'queued',
                      order: maxOrder + 1,
                    },
                  ];
                });
                setActiveTab('queue');
                notify(`Created a new queued post with "${media.name}".`);
              }}
            />
          )}

          {activeTab === 'connections' && (
            <ConnectionsView
              creds={creds}
              onUpdateCreds={(patch) => setCreds((prev) => ({ ...prev, ...patch }))}
              dispatchMode={dispatchMode}
              onChangeDispatchMode={(mode) => {
                setDispatchMode(mode);
                notify(
                  mode === 'dry-run'
                    ? 'Switched to Payload Dry-Run simulation mode.'
                    : mode === 'webhook'
                      ? 'Switched to Webhook Bridge dispatch mode.'
                      : 'Switched to Live Official Social APIs mode.'
                );
              }}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      <ConfirmReleaseModal
        post={confirmPost}
        media={
          confirmPost?.mediaId
            ? mediaLibrary.find((m) => m.id === confirmPost.mediaId)
            : undefined
        }
        dispatchMode={dispatchMode}
        onCancel={() => setConfirmPost(null)}
        onConfirm={(post) => {
          setConfirmPost(null);
          void executeSinglePostRelease(post);
        }}
      />
    </div>
  );
}
