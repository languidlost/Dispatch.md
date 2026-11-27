import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { MarkdownDoc, MediaAsset } from '../types';

let cachedAuth: ReturnType<typeof getAuth> | null = null;
let firebaseInitError: Error | null = null;

function getFirebaseAuth() {
  if (cachedAuth) return cachedAuth;
  if (firebaseInitError) throw firebaseInitError;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (err) {
    firebaseInitError =
      err instanceof Error ? err : new Error('Failed to initialize Firebase Authentication.');
    throw firebaseInitError;
  }
}

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
];

const provider = new GoogleAuthProvider();
for (const scope of GOOGLE_WORKSPACE_SCOPES) {
  provider.addScope(scope);
}

// Strict in-memory token cache (never stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthMissing?: (user: User | null) => void
) => {
  try {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          onAuthSuccess?.(user, cachedAccessToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          onAuthMissing?.(user);
        }
      } else {
        cachedAccessToken = null;
        onAuthMissing?.(null);
      }
    });
  } catch {
    onAuthMissing?.(null);
    return () => {};
  }
};

export const signInWithGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const auth = getFirebaseAuth();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google sign-in completed, but no access token was returned.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => cachedAccessToken;

export const signOutGoogle = async (): Promise<void> => {
  cachedAccessToken = null;
  try {
    const auth = getFirebaseAuth();
    await auth.signOut();
  } catch {
    // Ignore if Firebase auth is uninitialized
  }
};

export const parseDriveFolderId = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match URLs like https://drive.google.com/drive/folders/1AbCDef... or /u/0/folders/...
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];

  // Match ?id=...
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];

  // Raw Drive ID
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

export interface DriveFolderItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export async function listUserDriveFolders(token: string): Promise<DriveFolderItem[]> {
  const q = encodeURIComponent(
    "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc&pageSize=30`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Drive folder listing failed (${res.status})`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function getDriveFolderInfo(
  folderId: string,
  token: string
): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Unable to access Drive folder (${res.status})`);
  }
  return res.json();
}

export async function syncMarkdownFromDriveFolder(
  folderId: string,
  token: string
): Promise<MarkdownDoc[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and (name contains '.md' or name contains '.markdown' or mimeType = 'text/markdown' or mimeType = 'text/plain' or mimeType = 'application/vnd.google-apps.document')`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=50`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to list Drive files (${listRes.status})`);
  }
  const listData = await listRes.json();
  const files: DriveFolderItem[] = listData.files || [];

  const docs: MarkdownDoc[] = [];
  for (const file of files) {
    const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
    const contentUrl = isGoogleDoc
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/markdown`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;

    const contentRes = await fetch(contentUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!contentRes.ok) continue;
    const text = await contentRes.text();
    const title = file.name.replace(/\.(md|markdown|txt)$/i, '');

    docs.push({
      id: `drive-${file.id}`,
      title,
      filename: file.name.endsWith('.md') ? file.name : `${file.name}.md`,
      content: text,
      source: 'drive',
      driveFileId: file.id,
      folderId,
      updatedAt: file.modifiedTime || new Date().toISOString(),
      selected: true,
    });
  }

  return docs;
}

async function fetchAuthenticatedImageObjectUrl(
  fileId: string,
  token: string
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Drive image (${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function syncImagesFromDriveFolder(
  folderId: string,
  token: string
): Promise<MediaAsset[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,webContentLink)&pageSize=30`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to list Drive images (${listRes.status})`);
  }
  const listData = await listRes.json();
  const files: Array<DriveFolderItem & { webContentLink?: string }> = listData.files || [];

  const assets: MediaAsset[] = [];
  for (const file of files) {
    try {
      const objectUrl = await fetchAuthenticatedImageObjectUrl(file.id, token);
      assets.push({
        id: `drive-img-${file.id}`,
        name: file.name,
        source: 'google-drive',
        url: objectUrl,
        publicUrl: file.webContentLink,
        mimeType: file.mimeType,
        driveFileId: file.id,
        folderId,
        createdAt: file.modifiedTime || new Date().toISOString(),
      });
    } catch {
      // Skip unreadable file without breaking batch
    }
  }
  return assets;
}

export async function listGooglePhotosItems(token: string): Promise<MediaAsset[]> {
  // Query photos space + fallback to recent image files accessible via drive.photos.readonly / drive.readonly
  const q = encodeURIComponent("trashed = false and mimeType contains 'image/'");
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=photos,drive&q=${q}&fields=files(id,name,mimeType,modifiedTime,webContentLink)&orderBy=modifiedTime desc&pageSize=24`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Google Photos fetch failed (${listRes.status})`);
  }
  const listData = await listRes.json();
  const files: Array<DriveFolderItem & { webContentLink?: string }> = listData.files || [];

  const assets: MediaAsset[] = [];
  for (const file of files) {
    try {
      const objectUrl = await fetchAuthenticatedImageObjectUrl(file.id, token);
      assets.push({
        id: `gphoto-${file.id}`,
        name: file.name,
        source: 'google-photos',
        url: objectUrl,
        publicUrl: file.webContentLink,
        mimeType: file.mimeType,
        driveFileId: file.id,
        createdAt: file.modifiedTime || new Date().toISOString(),
      });
    } catch {
      // Skip unreadable item
    }
  }
  return assets;
}
