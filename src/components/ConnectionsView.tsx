import React, { useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, ShieldCheck, Webhook } from 'lucide-react';
import { DispatchMode, SocialCredentialsMemory } from '../types';
import {
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
  dispatchMode: DispatchMode;
  onChangeDispatchMode: (mode: DispatchMode) => void;
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

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  creds,
  onUpdateCreds,
  dispatchMode,
  onChangeDispatchMode,
  onNotify,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [metaPages, setMetaPages] = useState<FacebookManagedPage[]>([]);
  const [isMetaAuthLoading, setIsMetaAuthLoading] = useState(false);
  const [isTwitterAuthLoading, setIsTwitterAuthLoading] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [showMetaOAuthAdvanced, setShowMetaOAuthAdvanced] = useState(false);
  const [showWorkerSnippet, setShowWorkerSnippet] = useState(false);

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
      const pages = await fetchMetaManagedPages(creds.facebookPageToken.trim());
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
        onNotify(`Loaded ${pages.length} Facebook Page(s) from Graph API v21.0.`);
      } else if (creds.facebookPageId.trim()) {
        const page = await testFacebookPageConnection(
          creds.facebookPageId,
          creds.facebookPageToken
        );
        onUpdateCreds({ facebookPageName: page.name });
        onNotify(`Verified Page token directly for "${page.name}".`);
      } else {
        onNotify(
          'Token is valid, or if using a direct Page Token, enter your Facebook Page ID below and click Test Page.',
          'error'
        );
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
      onUpdateCreds({ facebookPageName: page.name });
      onNotify(`Verified Facebook Page "${page.name}" (${page.id}).`);
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
          ? 'Browser blocked direct fetch to api.x.com (CORS). Add a Cloudflare Worker CORS Relay URL below or use Webhook Bridge mode.'
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
          Choose the connection method that fits your setup: direct Graph tokens (no OAuth redirect needed), X CORS Relay / Composer, popup OAuth, or an automation webhook bridge.
        </p>
      </div>

      {/* Dispatch Mode Selector */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Dispatch Execution Mode
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select how queued posts are sent when released individually or on schedule.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {(
              [
                { id: 'dry-run', label: 'Payload Dry-Run' },
                { id: 'official', label: 'Live Official APIs' },
                { id: 'webhook', label: 'Webhook Bridge' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeDispatchMode(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  dispatchMode === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
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

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="font-medium text-slate-900">Quick 3-step setup (no OAuth redirect needed):</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Open Meta Graph API Explorer above, choose your Meta App (or create a quick Business app), and add permissions:{' '}
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
            <li>Click <strong>Generate Access Token</strong> and approve your Page &amp; linked Instagram Business account.</li>
            <li>Paste the token below and click <strong>Load Pages &amp; Instagram</strong>.</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-8">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session Graph API User or Page Access Token (In-Memory Only)
            </label>
            <input
              type="password"
              value={creds.facebookPageToken}
              onChange={(e) => onUpdateCreds({ facebookPageToken: e.target.value })}
              placeholder="Paste token from Meta Graph API Explorer..."
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
            onClick={() => onChangeDispatchMode('webhook')}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
          >
            Activate Webhook Mode
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
