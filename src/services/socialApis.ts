import {
  MediaAsset,
  PublishAttemptResult,
  SocialCredentialsMemory,
  SocialPlatform,
} from '../types';

export interface SocialOAuthPopupResult {
  platform: 'facebook' | 'twitter';
  accessToken?: string;
  code?: string;
  state?: string;
  error?: string;
}

export interface FacebookManagedPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
}

export function getStaticCallbackUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

// Handle OAuth popup return on static GitHub Pages URLs
export function handleStaticOAuthCallbackIfPopup(): boolean {
  if (!window.opener) return false;
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const accessToken = hashParams.get('access_token');
  const error = searchParams.get('error') || hashParams.get('error');

  if (code || accessToken || error) {
    window.opener.postMessage(
      {
        type: 'DISPATCH_SOCIAL_OAUTH_CALLBACK',
        code,
        state,
        accessToken,
        error,
      },
      window.location.origin
    );
    window.close();
    return true;
  }
  return false;
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

export async function startTwitterPkceOAuth(clientId: string): Promise<{
  accessToken: string;
  handle: string;
}> {
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

  const authUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`;
  const code = await openOAuthPopupAndWaitForCode(authUrl, state);

  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId.trim(),
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(
      err?.error_description ||
        err?.error ||
        `X OAuth token exchange failed (${tokenRes.status}). Verify redirect URI & public client settings.`
    );
  }
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token as string;
  const userInfo = await verifyTwitterToken(accessToken);
  return { accessToken, handle: userInfo.username };
}

export async function verifyTwitterToken(accessToken: string): Promise<{
  id: string;
  username: string;
  name: string;
}> {
  const res = await fetch('https://api.x.com/2/users/me', {
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

function openOAuthPopupAndWaitForCode(url: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'social_oauth_popup', 'width=600,height=720');
    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Allow popups to authorize.'));
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        window.removeEventListener('message', onMessage);
        reject(new Error('Authorization window was closed before completing.'));
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'DISPATCH_SOCIAL_OAUTH_CALLBACK') return;
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      if (event.data.error) {
        reject(new Error(String(event.data.error)));
        return;
      }
      if (event.data.state !== expectedState) {
        reject(new Error('OAuth state mismatch.'));
        return;
      }
      resolve(String(event.data.code));
    };

    window.addEventListener('message', onMessage);
  });
}

function openOAuthPopupAndWaitForToken(url: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'meta_oauth_popup', 'width=620,height=740');
    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Allow popups to authorize.'));
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        window.removeEventListener('message', onMessage);
        reject(new Error('Authorization window was closed before completing.'));
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'DISPATCH_SOCIAL_OAUTH_CALLBACK') return;
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      if (event.data.error) {
        reject(new Error(String(event.data.error)));
        return;
      }
      if (event.data.state && event.data.state !== expectedState) {
        reject(new Error('OAuth state mismatch.'));
        return;
      }
      if (!event.data.accessToken) {
        reject(new Error('No access token received from Meta OAuth.'));
        return;
      }
      resolve(String(event.data.accessToken));
    };

    window.addEventListener('message', onMessage);
  });
}

export function buildApiPayloadPreview(
  platform: SocialPlatform,
  text: string,
  creds: SocialCredentialsMemory,
  media?: MediaAsset
): { method: string; endpoint: string; body: Record<string, unknown> } {
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

  return {
    method: 'POST',
    endpoint: 'https://api.x.com/2/tweets',
    body: {
      text,
    },
  };
}

export async function publishToSocialPlatform(
  platform: SocialPlatform,
  text: string,
  creds: SocialCredentialsMemory,
  options: { dryRun: boolean; media?: MediaAsset }
): Promise<PublishAttemptResult> {
  const now = new Date().toISOString();
  const preview = buildApiPayloadPreview(platform, text, creds, options.media);

  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      externalId: `dryrun-${platform}-${Date.now()}`,
      timestamp: now,
      endpoint: `${preview.method} ${preview.endpoint}`,
    };
  }

  try {
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

      // Step 1: Create media container
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

      // Step 2: Publish container
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

    // X (Twitter) API v2
    if (!creds.twitterAccessToken) {
      throw new Error('X (Twitter) OAuth 2.0 Access Token is required.');
    }
    const tweetText =
      options.media?.publicUrl && text.length + options.media.publicUrl.length + 2 <= 280
        ? `${text}\n${options.media.publicUrl}`
        : text;

    const res = await fetch('https://api.x.com/2/tweets', {
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
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected network or API error.',
      timestamp: now,
      endpoint: preview.endpoint,
    };
  }
}
