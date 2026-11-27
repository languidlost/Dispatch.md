import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Code2,
  Image as ImageIcon,
  Search,
  Send,
  Trash2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  DispatchMode,
  MediaAsset,
  QueuePost,
  SocialCredentialsMemory,
  SocialPlatform,
} from '../types';
import { getCharDiagnostics } from '../services/snipEngine';
import { buildApiPayloadPreview } from '../services/socialApis';
import { MediaImage } from './MediaImage';

interface QueueWorkspaceProps {
  queue: QueuePost[];
  mediaLibrary: MediaAsset[];
  creds: SocialCredentialsMemory;
  dispatchMode: DispatchMode;
  isReleasingId: string | null;
  onUpdatePost: (id: string, patch: Partial<QueuePost>) => void;
  onMovePost: (id: string, direction: 'up' | 'down') => void;
  onDeletePost: (id: string) => void;
  onRequestRelease: (post: QueuePost) => void;
  onNavigateTab: (tab: 'repository' | 'rules' | 'media') => void;
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
};

export const QueueWorkspace: React.FC<QueueWorkspaceProps> = ({
  queue,
  mediaLibrary,
  creds,
  dispatchMode,
  isReleasingId,
  onUpdatePost,
  onMovePost,
  onDeletePost,
  onRequestRelease,
  onNavigateTab,
}) => {
  const [filter, setFilter] = useState<'pending' | 'published' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('twitter');
  const [showPayload, setShowPayload] = useState(false);

  const mediaMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    mediaLibrary.forEach((m) => map.set(m.id, m));
    return map;
  }, [mediaLibrary]);

  const sortedQueue = useMemo(
    () => [...queue].sort((a, b) => a.order - b.order),
    [queue]
  );

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedQueue.filter((post) => {
      if (filter === 'pending' && post.status === 'published') return false;
      if (filter === 'published' && post.status !== 'published') return false;
      if (!q) return true;
      return (
        post.text.toLowerCase().includes(q) ||
        post.sourceDocTitle.toLowerCase().includes(q) ||
        post.ruleName.toLowerCase().includes(q)
      );
    });
  }, [sortedQueue, filter, search]);

  const activePost = useMemo(() => {
    if (selectedPostId) {
      const found = sortedQueue.find((p) => p.id === selectedPostId);
      if (found) return found;
    }
    return filteredPosts[0] || sortedQueue[0] || null;
  }, [selectedPostId, sortedQueue, filteredPosts]);

  const activeMedia = activePost?.mediaId ? mediaMap.get(activePost.mediaId) : undefined;

  const activePreviewPlatform: SocialPlatform = useMemo(() => {
    if (!activePost) return previewPlatform;
    if (activePost.platforms.includes(previewPlatform)) return previewPlatform;
    return activePost.platforms[0] || previewPlatform;
  }, [activePost, previewPlatform]);

  const payloadPreview = useMemo(() => {
    if (!activePost) return null;
    return buildApiPayloadPreview(
      activePreviewPlatform,
      activePost.text,
      creds,
      activeMedia,
      dispatchMode
    );
  }, [activePost, activePreviewPlatform, creds, activeMedia, dispatchMode]);

  const togglePlatform = (post: QueuePost, platform: SocialPlatform) => {
    const has = post.platforms.includes(platform);
    const next = has
      ? post.platforms.filter((p) => p !== platform)
      : [...post.platforms, platform];
    onUpdatePost(post.id, { platforms: next });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Publishing Queue
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review extracted Markdown excerpts, adjust targets or attached photos, and release posts one at a time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter queue..."
              aria-label="Filter queue posts"
              className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 w-48 sm:w-56"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {(['pending', 'published', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split View */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <p className="text-base font-semibold text-slate-900">
            {filter === 'published'
              ? 'No published posts yet'
              : 'No posts waiting in this queue view'}
          </p>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Upload Markdown files or sync a Google Drive folder, then apply a snipping rule to populate your publishing queue.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigateTab('repository')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Open Markdown Repository
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('rules')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Configure Snip Rules
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Queue List */}
          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {filteredPosts.map((post, idx) => {
              const isSelected = activePost?.id === post.id;
              const attachedMedia = post.mediaId ? mediaMap.get(post.mediaId) : undefined;
              const diagnostics = getCharDiagnostics(post.text, post.platforms);
              const overLimit = diagnostics.some((d) => d.overLimit);
              const isBusy = isReleasingId === post.id;

              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPostId(post.id)}
                  className={`p-4 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/45' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Unboxed Metadata Row */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                      <span className="font-mono tabular-nums font-medium text-slate-700">
                        #{idx + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate font-medium text-slate-700">
                        {post.sourceDocTitle}.md
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          post.status === 'published'
                            ? 'text-emerald-700 font-medium'
                            : post.status === 'failed'
                              ? 'text-red-700 font-medium'
                              : post.status === 'scheduled'
                                ? 'text-blue-700 font-medium'
                                : 'text-slate-600'
                        }
                      >
                        {post.status === 'published'
                          ? 'Published'
                          : post.status === 'failed'
                            ? 'Attention needed'
                            : post.status === 'scheduled'
                              ? 'Scheduled'
                              : 'Queued'}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onMovePost(post.id, 'up')}
                        disabled={idx === 0 || post.status === 'published'}
                        aria-label="Move post up"
                        className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMovePost(post.id, 'down')}
                        disabled={idx === filteredPosts.length - 1 || post.status === 'published'}
                        aria-label="Move post down"
                        className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePost(post.id)}
                        aria-label="Remove post from queue"
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Excerpt + Thumbnail */}
                  <div className="flex gap-4">
                    <p className="flex-1 text-sm text-slate-800 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                      {post.text}
                    </p>
                    {attachedMedia && (
                      <div className="w-20 h-16 shrink-0 rounded-md overflow-hidden border border-slate-200">
                        <MediaImage
                          src={attachedMedia.url}
                          alt={attachedMedia.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Bottom Control Strip */}
                  <div
                    className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3 text-xs">
                      {(['twitter', 'facebook', 'instagram'] as SocialPlatform[]).map((p) => {
                        const checked = post.platforms.includes(p);
                        return (
                          <label
                            key={p}
                            className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={post.status === 'published'}
                              onChange={() => togglePlatform(post, p)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span>{PLATFORM_LABELS[p]}</span>
                          </label>
                        );
                      })}
                      <span
                        className={`font-mono tabular-nums ${
                          overLimit ? 'text-red-600 font-medium' : 'text-slate-500'
                        }`}
                      >
                        {post.text.length} chars
                      </span>
                    </div>

                    {post.status !== 'published' ? (
                      <button
                        type="button"
                        disabled={isBusy || post.platforms.length === 0}
                        onClick={() => onRequestRelease(post)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                      >
                        <Send className="w-3 h-3" />
                        <span>{isBusy ? 'Sending...' : 'Release'}</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Sent'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Single-Post Preview & Editor */}
          {activePost && (
            <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5 xl:sticky xl:top-20">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Single-Post Preview
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    From {activePost.sourceDocTitle}.md · {activePost.ruleName}
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['twitter', 'instagram', 'facebook'] as SocialPlatform[]).map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setPreviewPlatform(platform)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        activePreviewPlatform === platform
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {PLATFORM_LABELS[platform]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Realistic Social Frame Preview */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {activePreviewPlatform === 'twitter'
                      ? `@${creds.twitterHandle || 'your_handle'}`
                      : activePreviewPlatform === 'instagram'
                        ? `@${creds.instagramUsername || 'your_instagram'}`
                        : creds.facebookPageName || 'Your Facebook Page'}
                  </span>
                  <span className="font-mono tabular-nums">
                    {activePost.text.length} /{' '}
                    {activePreviewPlatform === 'twitter'
                      ? '280'
                      : activePreviewPlatform === 'instagram'
                        ? '2,200'
                        : '63,206'}
                  </span>
                </div>

                {activeMedia && (
                  <div className="rounded-md overflow-hidden border border-slate-200 bg-white">
                    <MediaImage
                      src={activeMedia.url}
                      alt={activeMedia.name}
                      className="w-full h-52 object-cover"
                    />
                  </div>
                )}

                <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
                  {activePost.text}
                </p>

                {activePreviewPlatform === 'twitter' && activePost.text.length > 280 && (
                  <p className="text-xs text-red-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Exceeds X 280-character limit by {activePost.text.length - 280} chars.</span>
                  </p>
                )}

                {activePreviewPlatform === 'instagram' && !activeMedia && (
                  <p className="text-xs text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Instagram posts require an attached photo with a public HTTPS URL.</span>
                  </p>
                )}
              </div>

              {/* Edit Post Copy, Schedule Time & Photo */}
              {activePost.status !== 'published' && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="active-post-editor"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Edit Post Copy
                    </label>
                    <textarea
                      id="active-post-editor"
                      rows={4}
                      value={activePost.text}
                      onChange={(e) => onUpdatePost(activePost.id, { text: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="active-post-media"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Attached Google Photo / Media
                      </label>
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <select
                          id="active-post-media"
                          value={activePost.mediaId || ''}
                          onChange={(e) =>
                            onUpdatePost(activePost.id, {
                              mediaId: e.target.value || undefined,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900"
                        >
                          <option value="">No image attached</option>
                          {mediaLibrary.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.source})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="active-post-schedule"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Specific Release Time (Optional)
                      </label>
                      <input
                        id="active-post-schedule"
                        type="datetime-local"
                        value={activePost.scheduledAt || ''}
                        onChange={(e) =>
                          onUpdatePost(activePost.id, {
                            scheduledAt: e.target.value || undefined,
                            status: e.target.value ? 'scheduled' : 'queued',
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-md bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Publish Results if previously attempted */}
              {activePost.results && Object.keys(activePost.results).length > 0 && (
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <div className="text-xs font-medium text-slate-700">Dispatch Results</div>
                  {(Object.entries(activePost.results) as Array<[SocialPlatform, NonNullable<QueuePost['results']>[SocialPlatform]]>).map(
                    ([plat, res]) =>
                      res && (
                        <div
                          key={plat}
                          className="text-xs flex items-start justify-between gap-2 py-1 border-b border-slate-100 last:border-0"
                        >
                          <span className="font-medium text-slate-800">
                            {PLATFORM_LABELS[plat]}
                          </span>
                          {res.ok ? (
                            <span className="text-emerald-700 font-mono text-right">
                              {res.dryRun ? 'Simulated' : 'Published'} ({res.externalId})
                            </span>
                          ) : (
                            <span className="text-red-700 text-right">{res.error}</span>
                          )}
                        </div>
                      )
                  )}
                </div>
              )}

              {/* API Payload Inspector + Release Action */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPayload((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{showPayload ? 'Hide API Payload' : 'Inspect API Payload'}</span>
                  </button>

                  {activePost.platforms.includes('twitter') && (
                    <a
                      href={`https://x.com/intent/tweet?text=${encodeURIComponent(activePost.text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-700"
                    >
                      <span>Open in X Composer</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {showPayload && payloadPreview && (
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
                    {`${payloadPreview.method} ${payloadPreview.endpoint}\n\n${JSON.stringify(
                      payloadPreview.body,
                      null,
                      2
                    )}`}
                  </pre>
                )}

                {activePost.status !== 'published' && (
                  <button
                    type="button"
                    disabled={isReleasingId === activePost.id || activePost.platforms.length === 0}
                    onClick={() => onRequestRelease(activePost)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {dispatchMode === 'dry-run'
                        ? 'Simulate Release of This Post'
                        : dispatchMode === 'webhook'
                          ? 'Dispatch via Webhook Bridge'
                          : 'Release This Post Now'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
