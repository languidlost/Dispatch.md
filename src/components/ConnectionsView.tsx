import React, { useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react';
import { SocialCredentialsMemory } from '../types';
import {
  FacebookManagedPage,
  fetchMetaManagedPages,
  getStaticCallbackUri,
  startMetaGraphOAuth,
  startTwitterPkceOAuth,
  verifyTwitterToken,
} from '../services/socialApis';

interface ConnectionsViewProps {
  creds: SocialCredentialsMemory;
  onUpdateCreds: (patch: Partial<SocialCredentialsMemory>) => void;
  dryRunMode: boolean;
  onToggleDryRun: (next: boolean) => void;
  onNotify: (msg: string, type?: 'info' | 'error') => void;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  creds,
  onUpdateCreds,
  dryRunMode,
  onToggleDryRun,
  onNotify,
}) => {
  const [copiedUri, setCopiedUri] = useState(false);
  const [metaPages, setMetaPages] = useState<FacebookManagedPage[]>([]);
  const [isMetaAuthLoading, setIsMetaAuthLoading] = useState(false);
  const [isTwitterAuthLoading, setIsTwitterAuthLoading] = useState(false);

  const callbackUri = getStaticCallbackUri();

  const handleCopyCallback = async () => {
    await navigator.clipboard.writeText(callbackUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 1800);
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
    if (!creds.facebookPageToken) {
      onNotify('Enter a Meta User or Page Access Token first.', 'error');
      return;
    }
    setIsMetaAuthLoading(true);
    try {
      const pages = await fetchMetaManagedPages(creds.facebookPageToken);
      setMetaPages(pages);
      if (pages.length > 0) {
        const first = pages[0];
        onUpdateCreds({
          facebookPageId: first.id,
          facebookPageName: first.name,
          facebookPageToken: first.access_token || creds.facebookPageToken,
          instagramUserId: first.instagram_business_account?.id || creds.instagramUserId,
          instagramUsername:
            first.instagram_business_account?.username || creds.instagramUsername,
        });
        onNotify(`Loaded ${pages.length} Facebook Page(s) from Graph API v21.0.`);
      } else {
        onNotify('Token verified, or no managed pages found on /me/accounts.');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to query Meta Pages.', 'error');
    } finally {
      setIsMetaAuthLoading(false);
    }
  };

  const handleTwitterOAuth = async () => {
    setIsTwitterAuthLoading(true);
    try {
      const { accessToken, handle } = await startTwitterPkceOAuth(creds.twitterClientId);
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
    if (!creds.twitterAccessToken) {
      onNotify('Enter an X OAuth 2.0 User Access Token first.', 'error');
      return;
    }
    setIsTwitterAuthLoading(true);
    try {
      const user = await verifyTwitterToken(creds.twitterAccessToken);
      onUpdateCreds({ twitterHandle: user.username });
      onNotify(`Verified X API v2 token for @${user.username}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to verify X token.', 'error');
    } finally {
      setIsTwitterAuthLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Official Social APIs &amp; GitHub Pages Deployment
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Connect official Facebook Graph API v21.0, Instagram Graph API v21.0, and X API v2 accounts directly from the browser. Access tokens remain strictly in session memory.
        </p>
      </div>

      {/* Dispatch Mode & Static OAuth Callback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Dispatch Execution Mode
            </h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onToggleDryRun(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  dryRunMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Payload Dry-Run
              </button>
              <button
                type="button"
                onClick={() => onToggleDryRun(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  !dryRunMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Live APIs
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Use <strong>Payload Dry-Run</strong> to verify queue intervals, snipping rules, and official Graph API / X API v2 payloads without sending live posts. Switch to <strong>Live APIs</strong> once your account tokens are active.
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Static OAuth Redirect URI
            </h2>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xs text-slate-600">
            Add this exact URL in Meta Developers and the X Developer Portal (works on GitHub Pages with zero backend):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 truncate">
              {callbackUri}
            </code>
            <button
              type="button"
              onClick={handleCopyCallback}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer shrink-0"
            >
              {copiedUri ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUri ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </section>
      </div>

      {/* Meta: Facebook + Instagram Graph API v21.0 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Facebook &amp; Instagram (Meta Graph API v21.0)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Publishes via <code className="font-mono">/&#123;page-id&#125;/feed</code>,{' '}
              <code className="font-mono">/&#123;page-id&#125;/photos</code>, and Instagram{' '}
              <code className="font-mono">/&#123;ig-user-id&#125;/media</code> +{' '}
              <code className="font-mono">/media_publish</code>.
            </p>
          </div>
          <a
            href="https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
          >
            <span>Meta API Docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Meta App ID (for Popup OAuth)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={creds.facebookAppId}
                onChange={(e) => onUpdateCreds({ facebookAppId: e.target.value })}
                placeholder="123456789012345"
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                disabled={isMetaAuthLoading || !creds.facebookAppId}
                onClick={handleMetaOAuth}
                className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
              >
                {isMetaAuthLoading ? 'Connecting...' : 'Connect Meta'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session Page / User Access Token (In-Memory Only)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={creds.facebookPageToken}
                onChange={(e) => onUpdateCreds({ facebookPageToken: e.target.value })}
                placeholder="Paste Meta Graph token..."
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                disabled={isMetaAuthLoading || !creds.facebookPageToken}
                onClick={handleDiscoverMetaPages}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Load Pages
              </button>
            </div>
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
      </section>

      {/* X (Twitter) API v2 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              X / Twitter (Official API v2 — OAuth 2.0 PKCE)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Public client PKCE requires no client secret on GitHub Pages. Publishes to{' '}
              <code className="font-mono">POST https://api.x.com/2/tweets</code>.
            </p>
          </div>
          <a
            href="https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
          >
            <span>X API v2 Docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              X OAuth 2.0 Client ID (Public Client PKCE)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={creds.twitterClientId}
                onChange={(e) => onUpdateCreds({ twitterClientId: e.target.value })}
                placeholder="Your X OAuth 2.0 Client ID"
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                disabled={isTwitterAuthLoading || !creds.twitterClientId}
                onClick={handleTwitterOAuth}
                className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
              >
                {isTwitterAuthLoading ? 'Authorizing...' : 'Connect X'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Session User OAuth 2.0 Access Token (In-Memory Only)
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Verify</span>
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

      {/* GitHub Pages Deployment Checklist */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Zero-Backend GitHub Pages Hosting
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          This repository is configured with <code className="font-mono">base: &apos;./&apos;</code> in{' '}
          <code className="font-mono">vite.config.ts</code> and a plugin-free workflow at{' '}
          <code className="font-mono">.github/workflows/deploy.yml</code>. Push to{' '}
          <code className="font-mono">main</code> and enable <strong>GitHub Actions</strong> under Repository Settings &rarr; Pages to host it statically with zero backend servers. Add your GitHub Pages domain to Firebase Authentication Authorized Domains to keep Google Sign-In active in production.
        </p>
      </section>
    </div>
  );
};
