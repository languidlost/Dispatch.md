import React, { useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, KeyRound, ShieldCheck, Trash2, Upload, Webhook } from 'lucide-react';
import {
  PlatformDispatchConfig,
  PlatformDispatchMode,
  SocialCredentialsMemory,
  SocialPlatform,
} from '../types';
import {
  diagnoseUserTokenPermissions,
  FacebookManagedPage,
  fetchMetaManagedPages,
  getStaticCallbackUri,
  startMetaGraphOAuth,
  startTwitterPkceOAuth,
  testFacebookPageConnection,
  verifyTwitterToken,
} from '../services/socialApis';

interface ConnectionsViewProps {
  creds: SocialCredentialsMemory;
  onUpdateCreds: (patch: Partial<SocialCredentialsMemory>) => void;
  platformModes: PlatformDispatchConfig;
  onUpdatePlatformModes: (next: PlatformDispatchConfig) => void;
  onExportConfigJson: () => void;
  onImportConfigJson: (file: File) => Promise<void>;
  onClearSavedCreds: () => void;
  onNotify: (msg: string, type?: 'info' | 'error') => void;
}

const CLOUDFLARE_WORKER_SNIPPET = `export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    }
    const url = new URL(request.url);
    const target = "https://api.x.com" + url.pathname + url.search;
    const res = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: request.headers.get("Authorization") || "",
        "Content-Type": request.headers.get("Content-Type") || "application/json",
      },
      body: request.method === "GET" ? undefined : await request.text(),
    });
    const out = new Response(res.body, res);
    out.headers.set("Access-Control-Allow-Origin", "*");
    return out;
  },
};`;

const CHANNEL_META: Array<{ id: SocialPlatform; label: string; hint: string }> = [
  { id: 'facebook', label: 'Facebook', hint: 'Personal Copy & Post (User Profile), Page API v21.0, or Webhook' },
  { id: 'instagram', label: 'Instagram', hint: 'Personal Copy & Post, Business API v21.0, or Webhook' },
  { id: 'twitter', label: 'X (Twitter)', hint: 'X API v2, Personal Copy & Post, Webhook, or Skip' },
];

const MODE_OPTIONS: Array<{ id: PlatformDispatchMode; label: string }> = [
  { id: 'official', label: 'Live Page/API' },
  { id: 'composer', label: 'Personal Copy & Post' },
  { id: 'webhook', label: 'Webhook' },
  { id: 'dry-run', label: 'Dry-Run' },
  { id: 'skip', label: 'Skip' },
];

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  creds,
  onUpdateCreds,
  platformModes,
  onUpdatePlatformModes,
  onExportConfigJson,
  onImportConfigJson,
  onClearSavedCreds,
  onNotify,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [metaPages, setMetaPages] = useState<FacebookManagedPage[]>([]);
  const [isMetaAuthLoading, setIsMetaAuthLoading] = useState(false);
  const [isTwitterAuthLoading, setIsTwitterAuthLoading] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [showMetaOAuthAdvanced, setShowMetaOAuthAdvanced] = useState(false);
  const [showWorkerSnippet, setShowWorkerSnippet] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const callbackUri = getStaticCallbackUri();

  const copyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleMetaOAuth = async () => {
    setIsMetaAuthLoading(true);
    try {
      const { userAccessToken, pages } = await startMetaGraphOAuth(creds.facebookAppId);
      setMetaPages(pages);
      if (pages.length > 0) {
        const first = pages[0];
        onUpdateCreds({
          facebookPageId: first.id,
          facebookPageName: first.name,
          facebookPageToken: first.access_token || userAccessToken,
          instagramUserId: first.instagram_business_account?.id || creds.instagramUserId,
          instagramUsername:
            first.instagram_business_account?.username || creds.instagramUsername,
        });
        onNotify(`Connected Meta Graph API with ${pages.length} managed page(s).`);
      } else {
        onUpdateCreds({ facebookPageToken: userAccessToken });
        onNotify('Meta token obtained, but no managed Pages were returned.', 'error');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Meta OAuth failed.', 'error');
    } finally {
      setIsMetaAuthLoading(false);
    }
  };

  const handleDiscoverMetaPages = async () => {
    if (!creds.facebookPageToken.trim()) {
      onNotify('Paste a Meta Graph API Explorer User or Page Token first.', 'error');
      return;
    }
    setIsMetaAuthLoading(true);
    try {
      const pages = await fetchMetaManagedPages(
        creds.facebookPageToken.trim(),
        creds.facebookPageId.trim()
      );
      setMetaPages(pages);
      if (pages.length > 0) {
        const first = pages[0];
        onUpdateCreds({
          facebookPageId: first.id,
          facebookPageName: first.name,
          facebookPageToken: first.access_token || creds.facebookPageToken.trim(),
          instagramUserId: first.instagram_business_account?.id || creds.instagramUserId,
          instagramUsername:
            first.instagram_business_account?.username || creds.instagramUsername,
        });
        onNotify(
          `Loaded ${pages.length} Facebook Page(s) and stored the Page Access Token for "${first.name}".`
        );
      } else if (creds.facebookPageId.trim()) {
        const page = await testFacebookPageConnection(
          creds.facebookPageId,
          creds.facebookPageToken
        );
        onUpdateCreds({
          facebookPageId: page.id,
          facebookPageName: page.name,
          facebookPageToken: page.pageToken,
        });
        onNotify(`Verified Page token for "${page.name}".`);
      } else {
        const diagnostic = await diagnoseUserTokenPermissions(
          creds.facebookPageToken.trim(),
          creds.facebookPageId.trim()
        );
        onNotify(diagnostic, 'error');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to query Meta Pages.', 'error');
    } finally {
      setIsMetaAuthLoading(false);
    }
  };

  const handleTestFacebookPage = async () => {
    if (!creds.facebookPageId.trim() || !creds.facebookPageToken.trim()) {
      onNotify('Enter both Facebook Page ID and Page Access Token.', 'error');
      return;
    }
    setIsMetaAuthLoading(true);
    try {
      const page = await testFacebookPageConnection(
        creds.facebookPageId,
        creds.facebookPageToken
      );
      onUpdateCreds({
        facebookPageId: page.id,
        facebookPageName: page.name,
        facebookPageToken: page.pageToken,
      });
      onNotify(`Verified Facebook Page "${page.name}" (${page.id}) with a valid Page Access Token.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Facebook Page check failed.', 'error');
    } finally {
      setIsMetaAuthLoading(false);
    }
  };

  const handleTwitterOAuth = async () => {
    setIsTwitterAuthLoading(true);
    try {
      const { accessToken, handle } = await startTwitterPkceOAuth(
        creds.twitterClientId,
        creds.twitterCorsRelayUrl
      );
      onUpdateCreds({
        twitterAccessToken: accessToken,
        twitterHandle: handle,
      });
      onNotify(`Connected X account @${handle} via OAuth 2.0 PKCE.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'X OAuth 2.0 PKCE failed.', 'error');
    } finally {
      setIsTwitterAuthLoading(false);
    }
  };

  const handleVerifyTwitterToken = async () => {
    if (!creds.twitterAccessToken.trim()) {
      onNotify('Paste an X OAuth 2.0 User Access Token first.', 'error');
      return;
    }
    setIsTwitterAuthLoading(true);
    try {
      const user = await verifyTwitterToken(
        creds.twitterAccessToken.trim(),
        creds.twitterCorsRelayUrl
      );
      onUpdateCreds({ twitterHandle: user.username });
      onNotify(`Verified X API v2 token for @${user.username}.`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to verify X token.';
      onNotify(
        raw.toLowerCase().includes('failed to fetch')
          ? 'Browser blocked direct fetch to api.x.com (CORS). Add a Cloudflare Worker CORS Relay URL below or set X to Webhook / Skip.'
          : raw,
        'error'
      );
    } finally {
      setIsTwitterAuthLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!creds.webhookUrl.trim()) {
      onNotify('Enter a Webhook Bridge URL first.', 'error');
      return;
    }
    setIsTestingWebhook(true);
    try {
      const parsed = new URL(creds.webhookUrl.trim());
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
        throw new Error('Webhook URL must use https://.');
      }
      const res = await fetch(creds.webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          platform: 'twitter',
          text: 'Dispatch.md webhook connection check',
          dispatchedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        throw new Error(`Webhook returned HTTP ${res.status}.`);
      }
      onNotify('Webhook Bridge test succeeded.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Webhook test failed.', 'error');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Social Connections &amp; Static Hosting
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Facebook, Instagram, and X operate independently. All fields persist locally across refreshes and can be exported or restored as JSON anytime.
        </p>
      </div>

      {/* Browser Persistence & JSON Backup / Restore */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Saved Browser Persistence &amp; JSON Config Backup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tokens, Page IDs, handles, channel modes, and schedules are saved automatically in this browser. Download a JSON backup so you can re-upload everything in one click if fields are ever cleared.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void onImportConfigJson(file);
              }
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={onExportConfigJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON Backup</span>
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload JSON Backup</span>
          </button>
          <button
            type="button"
            onClick={onClearSavedCreds}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Saved Tokens</span>
          </button>
        </div>
      </section>

      {/* Independent Per-Channel Dispatch Routing */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Independent Channel Dispatch Modes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Each platform runs separately—if X fails or is skipped, Facebook and Instagram still publish cleanly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onUpdatePlatformModes({
                  facebook: 'composer',
                  instagram: 'composer',
                  twitter: 'composer',
                });
                onNotify('Set all channels to Personal Copy & Post (no Business account or Page required).');
              }}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer whitespace-nowrap"
            >
              Personal Profile (No Business)
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdatePlatformModes({
                  facebook: 'official',
                  instagram: 'official',
                  twitter: 'skip',
                });
                onNotify('Set Facebook & Instagram to Live Official API, and X to Skip.');
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer whitespace-nowrap"
            >
              Meta Live + Skip X
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdatePlatformModes({
                  facebook: 'dry-run',
                  instagram: 'dry-run',
                  twitter: 'dry-run',
                });
                onNotify('Set all channels to Dry-Run simulation mode.');
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
            >
              All Dry-Run
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {CHANNEL_META.map((ch) => (
            <div
              key={ch.id}
              className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm font-medium text-slate-900">{ch.label}</div>
                <div className="text-xs text-slate-500">{ch.hint}</div>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      onUpdatePlatformModes({
                        ...platformModes,
                        [ch.id]: opt.id,
                      })
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      platformModes[ch.id] === opt.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Meta: Guided Token Flow (No Redirect URI Required!) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Facebook &amp; Instagram — Direct Graph API Token (Recommended)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              No redirect URI or popup needed. Meta Graph API v21.0 accepts browser requests directly from GitHub Pages.
            </p>
          </div>
          <a
            href="https://developers.facebook.com/tools/explorer/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap"
          >
            <span>Open Meta Graph API Explorer</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5 leading-relaxed">
          <div className="font-semibold">Posting to a personal Facebook user profile vs. a Page:</div>
          <p>
            Meta permanently removed personal-timeline API posting (<code className="font-mono">publish_actions</code>) in 2018—no third-party app can auto-post to a personal Facebook user timeline via Graph API. You have two zero-registration options:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Personal Facebook account right now (no Page or Meta App):</strong> Switch Facebook above to <strong>Personal Copy &amp; Post</strong> (or click <strong>Personal Profile (No Business)</strong>). Releasing a post copies the text to your clipboard and gives you a direct link to paste onto your personal Facebook feed.
            </li>
            <li>
              <strong>Automated API posting without registering a real business:</strong> Creating a free <strong>&ldquo;Digital Creator&rdquo;</strong> or <strong>&ldquo;Personal Blog&rdquo;</strong> Facebook Page under your personal account + keeping a Meta App in <strong>Development Mode</strong> does <strong>not</strong> require legal business registration or verification.
            </li>
          </ul>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="font-medium text-slate-900">Automated Page API setup (for a Creator / Personal Blog Page, no legal business required):</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              In Graph API Explorer, choose your Meta App (<em>Manage everything on your Page</em> use case; Development Mode is fine for your own posts). Keep <strong>User or Page</strong> set to <strong>Get User Access Token</strong> — do <strong>not</strong> click &ldquo;Get Page Access Token&rdquo; directly (Meta&apos;s shortcut injects the deprecated <code className="font-mono">manage_pages</code> scope).
            </li>
            <li>
              Add permissions:{' '}
              <code className="font-mono text-slate-900">
                pages_manage_posts, pages_read_engagement, pages_show_list, instagram_basic, instagram_content_publish
              </code>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    'meta-perms',
                    'pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish'
                  )
                }
                className="ml-2 inline-flex items-center gap-1 text-blue-700 hover:underline cursor-pointer"
              >
                {copiedKey === 'meta-perms' ? 'Copied' : 'Copy permissions'}
              </button>
            </li>
            <li>
              Click <strong>Generate Access Token</strong> and in the Facebook login dialog <strong>check the box for your Facebook Page</strong> (or select <em>Opt in to all current and future Pages</em>).
            </li>
            <li>
              Paste that User Token below and click <strong>Load Pages &amp; Instagram</strong>—Dispatch.md automatically exchanges it for your real <strong>Page Access Token</strong> (or pick your Page name from the Graph API Explorer dropdown <em>after</em> generating the User Token).
            </li>
          </ol>
          <p className="text-slate-600 pt-1 border-t border-slate-200/80">
            <strong>If 0 Pages appear even with permissions granted:</strong> (1) Open{' '}
            <a
              href="https://www.facebook.com/settings?tab=business_tools"
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 hover:underline"
            >
              Facebook Business Integrations
            </a>
            , remove your Meta App so Facebook shows the Page checkbox again when you regenerate; or (2) ensure your account has <strong>Full Control</strong> on a Facebook Page (not just a personal profile); or (3) paste a permanent <strong>System User Token</strong> from Meta Business Settings + your numeric Facebook Page ID below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-8">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Meta Graph API Token (User Token with Page Permissions or Page Access Token — Saved Locally)
            </label>
            <input
              type="password"
              value={creds.facebookPageToken}
              onChange={(e) => onUpdateCreds({ facebookPageToken: e.target.value })}
              placeholder="Paste User or Page Token from Meta Graph API Explorer..."
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
            />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <button
              type="button"
              disabled={isMetaAuthLoading || !creds.facebookPageToken}
              onClick={handleDiscoverMetaPages}
              className="flex-1 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
            >
              {isMetaAuthLoading ? 'Loading...' : 'Load Pages & Instagram'}
            </button>
            <button
              type="button"
              disabled={isMetaAuthLoading || !creds.facebookPageId || !creds.facebookPageToken}
              onClick={handleTestFacebookPage}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              Test Page
            </button>
          </div>
        </div>

        {metaPages.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="text-xs font-medium text-slate-700">Select Managed Facebook Page:</div>
            <div className="flex flex-wrap gap-2">
              {metaPages.map((pg) => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() =>
                    onUpdateCreds({
                      facebookPageId: pg.id,
                      facebookPageName: pg.name,
                      facebookPageToken: pg.access_token || creds.facebookPageToken,
                      instagramUserId: pg.instagram_business_account?.id || '',
                      instagramUsername: pg.instagram_business_account?.username || '',
                    })
                  }
                  className={`px-3 py-1.5 text-xs rounded-md border cursor-pointer ${
                    creds.facebookPageId === pg.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {pg.name}
                  {pg.instagram_business_account
                    ? ` (@${pg.instagram_business_account.username || pg.instagram_business_account.id})`
                    : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Facebook Page ID
            </label>
            <input
              type="text"
              value={creds.facebookPageId}
              onChange={(e) => onUpdateCreds({ facebookPageId: e.target.value })}
              placeholder="e.g. 1048291029..."
              className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Facebook Page Name
            </label>
            <input
              type="text"
              value={creds.facebookPageName}
              onChange={(e) => onUpdateCreds({ facebookPageName: e.target.value })}
              placeholder="Studio Journal"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Instagram Business User ID
            </label>
            <input
              type="text"
              value={creds.instagramUserId}
              onChange={(e) => onUpdateCreds({ instagramUserId: e.target.value })}
              placeholder="e.g. 17841405..."
              className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Instagram Handle
            </label>
            <input
              type="text"
              value={creds.instagramUsername}
              onChange={(e) => onUpdateCreds({ instagramUsername: e.target.value })}
              placeholder="studio_journal"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowMetaOAuthAdvanced((v) => !v)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showMetaOAuthAdvanced ? 'Hide Popup OAuth Option' : 'Alternative: Connect via Meta App ID Popup'}
          </button>

          {showMetaOAuthAdvanced && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Meta App ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={creds.facebookAppId}
                    onChange={(e) => onUpdateCreds({ facebookAppId: e.target.value })}
                    placeholder="123456789012345"
                    className="flex-1 px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={isMetaAuthLoading || !creds.facebookAppId}
                    onClick={handleMetaOAuth}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    Popup OAuth
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Redirect URI for Meta App Settings:{' '}
                <code className="font-mono text-slate-700">{callbackUri}</code>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* X (Twitter) API v2 + Optional CORS Relay */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              X / Twitter — Direct Token, CORS Relay, or Composer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              X blocks direct browser CORS calls to <code className="font-mono">api.x.com</code> from static sites. Use a 15-line Cloudflare Worker relay, the Webhook Bridge below, or the one-click <strong>Open in X Composer</strong> button in your queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWorkerSnippet((v) => !v)}
            className="text-xs font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
          >
            {showWorkerSnippet ? 'Hide Cloudflare Worker Code' : 'View Free CORS Relay Snippet'}
          </button>
        </div>

        {showWorkerSnippet && (
          <div className="bg-slate-900 text-slate-100 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Deploy this to a free Cloudflare Worker, then paste its https://*.workers.dev URL below:</span>
              <button
                type="button"
                onClick={() => copyText('worker-code', CLOUDFLARE_WORKER_SNIPPET)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white cursor-pointer"
              >
                {copiedKey === 'worker-code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'worker-code' ? 'Copied' : 'Copy Worker'}</span>
              </button>
            </div>
            <pre className="text-xs font-mono overflow-x-auto leading-relaxed text-slate-200">
              {CLOUDFLARE_WORKER_SNIPPET}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Optional X CORS Relay URL
            </label>
            <input
              type="url"
              value={creds.twitterCorsRelayUrl}
              onChange={(e) => onUpdateCreds({ twitterCorsRelayUrl: e.target.value })}
              placeholder="https://x-relay.your-name.workers.dev"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session OAuth 2.0 User Access Token
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={creds.twitterAccessToken}
                onChange={(e) => onUpdateCreds({ twitterAccessToken: e.target.value })}
                placeholder="Paste OAuth 2.0 User Token..."
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                disabled={isTwitterAuthLoading || !creds.twitterAccessToken}
                onClick={handleVerifyTwitterToken}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Verify</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Or X OAuth 2.0 Client ID (PKCE Popup)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={creds.twitterClientId}
                onChange={(e) => onUpdateCreds({ twitterClientId: e.target.value })}
                placeholder="Client ID..."
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                disabled={isTwitterAuthLoading || !creds.twitterClientId}
                onClick={handleTwitterOAuth}
                className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
              >
                Connect
              </button>
            </div>
          </div>
        </div>

        {creds.twitterHandle && (
          <div className="text-xs text-emerald-700 font-medium">
            Verified X handle: @{creds.twitterHandle}
          </div>
        )}
      </section>

      {/* Alternative 3: Automation Webhook Bridge (Make / Zapier / n8n / IFTTT) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-slate-600" />
              <span>Alternative: Automation Webhook Bridge (Make, Zapier, n8n, IFTTT)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Zero Meta or X Developer App setup required. When Dispatch Mode is set to <strong>Webhook Bridge</strong>, each released post sends JSON (<code className="font-mono">platform, text, imageUrl</code>) to your webhook scenario, which posts to Facebook, Instagram, and X for you.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={creds.webhookUrl}
            onChange={(e) => onUpdateCreds({ webhookUrl: e.target.value })}
            placeholder="https://hook.us1.make.com/... or https://hooks.zapier.com/..."
            aria-label="Automation webhook URL"
            className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
          />
          <button
            type="button"
            disabled={isTestingWebhook || !creds.webhookUrl}
            onClick={handleTestWebhook}
            className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {isTestingWebhook ? 'Testing...' : 'Send Test Payload'}
          </button>
          <button
            type="button"
            disabled={!creds.webhookUrl}
            onClick={() => {
              onUpdatePlatformModes({
                ...platformModes,
                twitter: 'webhook',
              });
              onNotify('Routed X (Twitter) to Webhook Bridge without changing Facebook or Instagram.');
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
          >
            Route X to Webhook
          </button>
        </div>
      </section>

      {/* Static Redirect URI & GitHub Pages Hosting */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Zero-Backend GitHub Pages Hosting
          </h2>
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 truncate">
            {callbackUri}
          </code>
          <button
            type="button"
            onClick={() => copyText('uri', callbackUri)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer shrink-0"
          >
            {copiedKey === 'uri' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'uri' ? 'Copied' : 'Copy URI'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Configured with <code className="font-mono">base: &apos;./&apos;</code>,{' '}
          <code className="font-mono">public/.nojekyll</code>, and{' '}
          <code className="font-mono">.github/workflows/deploy.yml</code>. Under GitHub{' '}
          <strong>Settings &rarr; Pages &rarr; Source</strong>, select{' '}
          <strong>GitHub Actions</strong>. Add your GitHub Pages hostname to Firebase Authentication Authorized Domains for Google Drive/Photos sign-in.
        </p>
      </section>
    </div>
  );
};
