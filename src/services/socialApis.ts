import {
  DispatchMode,
  MediaAsset,
  PublishAttemptResult,
  SocialCredentialsMemory,
  SocialPlatform,
} from '../types';

export interface FacebookManagedPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
}

const OAUTH_CHANNEL_NAME = 'dispatchmd_oauth_v1';

export function getStaticCallbackUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function extractOAuthParamsFromUrl(urlString: string): {
  code: string | null;
  state: string | null;
  accessToken: string | null;
  error: string | null;
} {
  const parsed = new URL(urlString, window.location.origin);
  const searchParams = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  return {
    code: searchParams.get('code'),
    state: searchParams.get('state'),
    accessToken: hashParams.get('access_token'),
    error:
      searchParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error_description') ||
      hashParams.get('error'),
  };
}

// Handle OAuth popup return on static GitHub Pages URLs (works even when COOP clears window.opener)
export function handleStaticOAuthCallbackIfPopup(): boolean {
  const { code, state, accessToken, error } = extractOAuthParamsFromUrl(window.location.href);
  if (!code && !accessToken && !error) return false;

  const payload = {
    type: 'DISPATCH_SOCIAL_OAUTH_CALLBACK',
    code,
    state,
    accessToken,
    error,
  };

  let delivered = false;
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
      delivered = true;
    }
  } catch {
    // Fallback to window.opener below
  }

  if (window.opener) {
    try {
      window.opener.postMessage(payload, window.location.origin);
      delivered = true;
    } catch {
      // Ignore cross-origin opener error
    }
  }

  if (window.opener || delivered) {
    window.close();
    // Clean URL if popup wasn't permitted to close itself
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      // Ignore history error
    }
    return true;
  }

  return false;
}

function resolveTwitterApiUrl(path: string, relayBase?: string): string {
  const cleanRelay = (relayBase || '').trim().replace(/\/+$/, '');
  if (!cleanRelay) {
    return `https://api.x.com${path}`;
  }
  const parsed = new URL(cleanRelay);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('X CORS relay URL must use https://.');
  }
  return `${cleanRelay}${path}`;
}

// PKCE helpers for X (Twitter) API v2 OAuth 2.0 Public Client flow
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

export async function createTwitterAuthRequest(
  clientId: string
): Promise<{ authUrl: string; state: string; verifier: string; redirectUri: string }> {
  if (!clientId.trim()) {
    throw new Error('Enter your X (Twitter) OAuth 2.0 Client ID first.');
  }
  const { verifier, challenge } = await generatePkcePair();
  const state = crypto.randomUUID();
  const redirectUri = getStaticCallbackUri();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return {
    authUrl: `https://x.com/i/oauth2/authorize?${params.toString()}`,
    state,
    verifier,
    redirectUri,
  };
}

export async function exchangeTwitterAuthCode(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  verifier: string;
  relayUrl?: string;
}): Promise<{ accessToken: string; handle: string }> {
  const tokenEndpoint = resolveTwitterApiUrl('/2/oauth2/token', params.relayUrl);
  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      grant_type: 'authorization_code',
      client_id: params.clientId.trim(),
      redirect_uri: params.redirectUri,
      code_verifier: params.verifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(
      err?.error_description ||
        err?.error ||
        `X OAuth token exchange failed (${tokenRes.status}).`
    );
  }
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token as string;
  const userInfo = await verifyTwitterToken(accessToken, params.relayUrl);
  return { accessToken, handle: userInfo.username };
}

export async function startTwitterPkceOAuth(
  clientId: string,
  relayUrl?: string
): Promise<{
  accessToken: string;
  handle: string;
}> {
  const req = await createTwitterAuthRequest(clientId);
  const code = await openOAuthPopupAndWaitForCode(req.authUrl, req.state);
  return exchangeTwitterAuthCode({
    code,
    clientId,
    redirectUri: req.redirectUri,
    verifier: req.verifier,
    relayUrl,
  });
}

export async function verifyTwitterToken(
  accessToken: string,
  relayUrl?: string
): Promise<{
  id: string;
  username: string;
  name: string;
}> {
  const endpoint = resolveTwitterApiUrl('/2/users/me', relayUrl);
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || err?.title || `X API verification failed (${res.status})`);
  }
  const data = await res.json();
  return data.data;
}

export async function startMetaGraphOAuth(appId: string): Promise<{
  userAccessToken: string;
  pages: FacebookManagedPage[];
}> {
  if (!appId.trim()) {
    throw new Error('Enter your Meta App ID first.');
  }
  const state = crypto.randomUUID();
  const redirectUri = getStaticCallbackUri();

  const params = new URLSearchParams({
    client_id: appId.trim(),
    redirect_uri: redirectUri,
    response_type: 'token',
    state,
    scope:
      'pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish',
  });

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  const userAccessToken = await openOAuthPopupAndWaitForToken(authUrl, state);
  const pages = await fetchMetaManagedPages(userAccessToken);
  return { userAccessToken, pages };
}

export async function fetchMetaManagedPages(
  userOrPageToken: string
): Promise<FacebookManagedPage[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(
      userOrPageToken
    )}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Meta Graph API error (${res.status})`);
  }
  const json = await res.json();
  return json.data || [];
}

export async function testFacebookPageConnection(
  pageId: string,
  pageToken: string
): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(
      pageId.trim()
    )}?fields=id,name&access_token=${encodeURIComponent(pageToken.trim())}`
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `Facebook Page check failed (${res.status})`);
  }
  return { id: json.id, name: json.name };
}

function openOAuthPopupAndWaitForCode(url: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'social_oauth_popup', 'width=600,height=720');
    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Allow popups or use direct token mode.'));
      return;
    }

    let settled = false;
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(OAUTH_CHANNEL_NAME) : null;

    const cleanup = () => {
      window.clearInterval(timer);
      window.removeEventListener('message', onWindowMessage);
      channel?.close();
    };

    const handlePayload = (data: Record<string, unknown>) => {
      if (settled || data?.type !== 'DISPATCH_SOCIAL_OAUTH_CALLBACK') return;
      settled = true;
      cleanup();
      if (data.error) {
        reject(new Error(String(data.error)));
        return;
      }
      if (data.state !== expectedState) {
        reject(new Error('OAuth state mismatch.'));
        return;
      }
      resolve(String(data.code || ''));
    };

    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handlePayload(event.data || {});
    };

    if (channel) {
      channel.onmessage = (event) => handlePayload(event.data || {});
    }

    const timer = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(
          new Error(
            'Authorization window closed before returning a code. Use Direct Token or Webhook mode if popup OAuth is restricted.'
          )
        );
      }
    }, 600);

    window.addEventListener('message', onWindowMessage);
  });
}

function openOAuthPopupAndWaitForToken(url: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'meta_oauth_popup', 'width=620,height=740');
    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Use Direct Graph Token mode below instead.'));
      return;
    }

    let settled = false;
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(OAUTH_CHANNEL_NAME) : null;

    const cleanup = () => {
      window.clearInterval(timer);
      window.removeEventListener('message', onWindowMessage);
      channel?.close();
    };

    const handlePayload = (data: Record<string, unknown>) => {
      if (settled || data?.type !== 'DISPATCH_SOCIAL_OAUTH_CALLBACK') return;
      settled = true;
      cleanup();
      if (data.error) {
        reject(new Error(String(data.error)));
        return;
      }
      if (data.state && data.state !== expectedState) {
        reject(new Error('OAuth state mismatch.'));
        return;
      }
      if (!data.accessToken) {
        reject(new Error('No access token received from Meta OAuth.'));
        return;
      }
      resolve(String(data.accessToken));
    };

    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handlePayload(event.data || {});
    };

    if (channel) {
      channel.onmessage = (event) => handlePayload(event.data || {});
    }

    const timer = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(
          new Error(
            'Meta popup closed before returning a token. Use the Guided Graph Token setup below instead (no popup or redirect URI needed).'
          )
        );
      }
    }, 600);

    window.addEventListener('message', onWindowMessage);
  });
}

export function buildApiPayloadPreview(
  platform: SocialPlatform,
  text: string,
  creds: SocialCredentialsMemory,
  media?: MediaAsset,
  dispatchMode: DispatchMode = 'official'
): { method: string; endpoint: string; body: Record<string, unknown> } {
  if (dispatchMode === 'webhook') {
    return {
      method: 'POST',
      endpoint: creds.webhookUrl || '<automation-webhook-url>',
      body: {
        platform,
        text,
        imageUrl: media?.publicUrl || undefined,
        mediaName: media?.name || undefined,
      },
    };
  }

  if (platform === 'facebook') {
    const pageId = creds.facebookPageId || '{page-id}';
    if (media) {
      return {
        method: 'POST',
        endpoint: `https://graph.facebook.com/v21.0/${pageId}/photos`,
        body: {
          caption: text,
          ...(media.publicUrl ? { url: media.publicUrl } : { source: `<binary:${media.name}>` }),
          access_token: creds.facebookPageToken ? '••••••' : '<page-access-token>',
        },
      };
    }
    return {
      method: 'POST',
      endpoint: `https://graph.facebook.com/v21.0/${pageId}/feed`,
      body: {
        message: text,
        access_token: creds.facebookPageToken ? '••••••' : '<page-access-token>',
      },
    };
  }

  if (platform === 'instagram') {
    const igId = creds.instagramUserId || '{ig-user-id}';
    return {
      method: 'POST',
      endpoint: `https://graph.facebook.com/v21.0/${igId}/media -> /media_publish`,
      body: {
        image_url: media?.publicUrl || '<public-https-image-url-required>',
        caption: text,
        access_token: creds.facebookPageToken ? '••••••' : '<page-access-token>',
      },
    };
  }

  const xEndpoint = creds.twitterCorsRelayUrl
    ? `${creds.twitterCorsRelayUrl.replace(/\/+$/, '')}/2/tweets`
    : 'https://api.x.com/2/tweets';

  return {
    method: 'POST',
    endpoint: xEndpoint,
    body: {
      text,
    },
  };
}

export async function publishToSocialPlatform(
  platform: SocialPlatform,
  text: string,
  creds: SocialCredentialsMemory,
  options: { dispatchMode: DispatchMode; media?: MediaAsset; sourceDocTitle?: string }
): Promise<PublishAttemptResult> {
  const now = new Date().toISOString();
  const preview = buildApiPayloadPreview(
    platform,
    text,
    creds,
    options.media,
    options.dispatchMode
  );

  if (options.dispatchMode === 'dry-run') {
    return {
      ok: true,
      dryRun: true,
      externalId: `dryrun-${platform}-${Date.now()}`,
      timestamp: now,
      endpoint: `${preview.method} ${preview.endpoint}`,
    };
  }

  try {
    if (options.dispatchMode === 'webhook') {
      const url = creds.webhookUrl.trim();
      if (!url) {
        throw new Error('Enter a Webhook Bridge URL under Connections first.');
      }
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
        throw new Error('Webhook Bridge URL must use https://.');
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          text,
          imageUrl: options.media?.publicUrl || null,
          mediaName: options.media?.name || null,
          sourceDocTitle: options.sourceDocTitle || null,
          dispatchedAt: now,
        }),
      });
      if (!res.ok) {
        throw new Error(`Webhook bridge returned HTTP ${res.status}.`);
      }
      return {
        ok: true,
        externalId: `webhook-${platform}-${Date.now()}`,
        timestamp: now,
        endpoint: preview.endpoint,
      };
    }

    if (platform === 'facebook') {
      if (!creds.facebookPageId || !creds.facebookPageToken) {
        throw new Error('Facebook Page ID and Page Access Token are required.');
      }

      if (options.media) {
        const form = new FormData();
        form.append('caption', text);
        form.append('access_token', creds.facebookPageToken);

        if (options.media.publicUrl && /^https?:\/\//i.test(options.media.publicUrl)) {
          form.append('url', options.media.publicUrl);
        } else {
          const blobRes = await fetch(options.media.url);
          const blob = await blobRes.blob();
          form.append('source', blob, options.media.name || 'image.jpg');
        }

        const res = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(creds.facebookPageId)}/photos`,
          { method: 'POST', body: form }
        );
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json?.error?.message || `Facebook API error (${res.status})`);
        }
        return {
          ok: true,
          externalId: json.post_id || json.id,
          timestamp: now,
          endpoint: preview.endpoint,
        };
      }

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(creds.facebookPageId)}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            access_token: creds.facebookPageToken,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json?.error?.message || `Facebook API error (${res.status})`);
      }
      return {
        ok: true,
        externalId: json.id,
        timestamp: now,
        endpoint: preview.endpoint,
      };
    }

    if (platform === 'instagram') {
      if (!creds.instagramUserId || !creds.facebookPageToken) {
        throw new Error('Instagram Business Account ID and Meta Token are required.');
      }
      const publicImg = options.media?.publicUrl;
      if (!publicImg || !/^https?:\/\//i.test(publicImg)) {
        throw new Error(
          'Instagram Graph API v21.0 requires a publicly reachable HTTPS image URL on the attached photo.'
        );
      }

      const createRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(creds.instagramUserId)}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: publicImg,
            caption: text,
            access_token: creds.facebookPageToken,
          }),
        }
      );
      const createJson = await createRes.json();
      if (!createRes.ok || createJson.error || !createJson.id) {
        throw new Error(
          createJson?.error?.message || `Instagram container creation failed (${createRes.status})`
        );
      }

      const pubRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(creds.instagramUserId)}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: createJson.id,
            access_token: creds.facebookPageToken,
          }),
        }
      );
      const pubJson = await pubRes.json();
      if (!pubRes.ok || pubJson.error) {
        throw new Error(
          pubJson?.error?.message || `Instagram publish failed (${pubRes.status})`
        );
      }

      return {
        ok: true,
        externalId: pubJson.id,
        timestamp: now,
        endpoint: preview.endpoint,
      };
    }

    // X (Twitter) API v2 (direct or via user-supplied CORS relay)
    if (!creds.twitterAccessToken) {
      throw new Error('X (Twitter) OAuth 2.0 Access Token is required.');
    }
    const tweetText =
      options.media?.publicUrl && text.length + options.media.publicUrl.length + 2 <= 280
        ? `${text}\n${options.media.publicUrl}`
        : text;

    const tweetEndpoint = resolveTwitterApiUrl('/2/tweets', creds.twitterCorsRelayUrl);
    const res = await fetch(tweetEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.twitterAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: tweetText }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        json?.detail || json?.title || json?.error || `X API v2 error (${res.status})`
      );
    }
    const tweetId = json?.data?.id;
    return {
      ok: true,
      externalId: tweetId,
      permalink: tweetId ? `https://x.com/i/web/status/${tweetId}` : undefined,
      timestamp: now,
      endpoint: preview.endpoint,
    };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : 'Unexpected network or API error.';
    const corsHint =
      platform === 'twitter' && rawMsg.toLowerCase().includes('failed to fetch')
        ? ' Browser blocked cross-origin request to api.x.com (CORS). Add a Cloudflare Worker CORS Relay URL or switch to Webhook Bridge under Connections.'
        : '';
    return {
      ok: false,
      error: `${rawMsg}${corsHint}`,
      timestamp: now,
      endpoint: preview.endpoint,
    };
  }
}
