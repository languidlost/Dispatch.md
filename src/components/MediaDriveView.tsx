import React, { useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  FolderPlus,
  ImagePlus,
  LogOut,
  RefreshCw,
  Trash2,
  FolderOpen,
  Images,
} from 'lucide-react';
import { DriveFolderLink, MediaAsset } from '../types';
import { DriveFolderItem, parseDriveFolderId } from '../services/googleAuth';
import { GoogleSignInButton } from './GoogleSignInButton';
import { MediaImage } from './MediaImage';

interface MediaDriveViewProps {
  googleUser: User | null;
  hasGoogleToken: boolean;
  isSigningIn: boolean;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  driveFolders: DriveFolderLink[];
  availableDriveFolders: DriveFolderItem[];
  isSyncingFolderId: string | null;
  isLoadingPhotos: boolean;
  mediaLibrary: MediaAsset[];
  onLinkDriveFolder: (folderIdOrUrl: string, purpose: 'markdown' | 'photos') => void;
  onSyncDriveFolder: (folder: DriveFolderLink) => void;
  onRemoveDriveFolder: (id: string) => void;
  onFetchDriveFolderList: () => void;
  onLoadGooglePhotos: () => void;
  onUploadLocalImages: (files: FileList) => void;
  onUpdateMediaPublicUrl: (id: string, publicUrl: string) => void;
  onDeleteMedia: (id: string) => void;
  onCreatePostWithMedia: (media: MediaAsset) => void;
}

export const MediaDriveView: React.FC<MediaDriveViewProps> = ({
  googleUser,
  hasGoogleToken,
  isSigningIn,
  onGoogleLogin,
  onGoogleLogout,
  driveFolders,
  availableDriveFolders,
  isSyncingFolderId,
  isLoadingPhotos,
  mediaLibrary,
  onLinkDriveFolder,
  onSyncDriveFolder,
  onRemoveDriveFolder,
  onFetchDriveFolderList,
  onLoadGooglePhotos,
  onUploadLocalImages,
  onUpdateMediaPublicUrl,
  onDeleteMedia,
  onCreatePostWithMedia,
}) => {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [folderPurpose, setFolderPurpose] = useState<'markdown' | 'photos'>('markdown');

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderInput.trim()) return;
    onLinkDriveFolder(folderInput.trim(), folderPurpose);
    setFolderInput('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Google Drive &amp; Photos
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Sign in with Google to sync Markdown folders from Google Drive and pull images from linked Google Photos or Drive folders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasGoogleToken && googleUser ? (
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3.5 py-2">
              <div className="text-xs">
                <div className="font-medium text-slate-900">
                  {googleUser.displayName || googleUser.email}
                </div>
                <div className="text-slate-500">{googleUser.email}</div>
              </div>
              <button
                type="button"
                onClick={onGoogleLogout}
                aria-label="Sign out of Google"
                className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <GoogleSignInButton
              onClick={onGoogleLogin}
              disabled={isSigningIn}
              label={isSigningIn ? 'Signing in...' : 'Sign in with Google'}
            />
          )}
        </div>
      </div>

      {/* Linked Google Drive Folders */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Linked Google Drive Folders
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect a Drive folder URL or ID to automatically pull .md documents or photo assets.
            </p>
          </div>
          {hasGoogleToken && (
            <button
              type="button"
              onClick={onFetchDriveFolderList}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse My Drive Folders</span>
            </button>
          )}
        </div>

        <form onSubmit={handleAddFolder} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            type="text"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            placeholder="Paste Google Drive folder URL or Folder ID..."
            aria-label="Google Drive folder URL or ID"
            className="md:col-span-7 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
          <select
            value={folderPurpose}
            onChange={(e) => setFolderPurpose(e.target.value as 'markdown' | 'photos')}
            aria-label="Folder content type"
            className="md:col-span-3 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="markdown">Markdown (.md) Folder</option>
            <option value="photos">Photos / Images Folder</option>
          </select>
          <button
            type="submit"
            disabled={!parseDriveFolderId(folderInput)}
            className="md:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Link Folder</span>
          </button>
        </form>

        {/* Quick Picker from user's Drive folders */}
        {availableDriveFolders.length > 0 && (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
            <div className="text-xs font-medium text-slate-700">
              Your Recent Google Drive Folders (click to link):
            </div>
            <div className="flex flex-wrap gap-2">
              {availableDriveFolders.slice(0, 10).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onLinkDriveFolder(f.id, folderPurpose)}
                  className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md hover:border-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {driveFolders.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 border border-slate-100 rounded-lg bg-slate-50/50">
            No Google Drive folders linked yet. Paste a folder link above after signing in with Google.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {driveFolders.map((folder) => {
              const syncing = isSyncingFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{folder.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>
                        {folder.purpose === 'markdown' ? 'Markdown Files' : 'Photo Assets'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{folder.folderId}</span>
                      {folder.lastSyncedAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Synced {new Date(folder.lastSyncedAt).toLocaleTimeString()} ({folder.itemCount} items)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={!hasGoogleToken || syncing}
                      onClick={() => onSyncDriveFolder(folder)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveDriveFolder(folder.id)}
                      aria-label={`Unlink ${folder.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Google Photos & Media Assets */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Linked Google Photos &amp; Post Media
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Load images from your Google Photos / Drive library or attach local photos for Facebook, Instagram, and X.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onUploadLocalImages(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Upload Local Photo</span>
            </button>
            <button
              type="button"
              disabled={!hasGoogleToken || isLoadingPhotos}
              onClick={onLoadGooglePhotos}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
            >
              <Images className="w-3.5 h-3.5" />
              <span>{isLoadingPhotos ? 'Loading Photos...' : 'Fetch Google Photos'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {mediaLibrary.map((item) => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-lg overflow-hidden bg-white flex flex-col justify-between"
            >
              <div className="aspect-4/3 bg-slate-100 overflow-hidden">
                <MediaImage
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.source}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMedia(item.id)}
                    aria-label={`Remove ${item.name}`}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Public HTTPS URL (for Instagram API)
                  </label>
                  <input
                    type="url"
                    value={item.publicUrl || ''}
                    onChange={(e) => onUpdateMediaPublicUrl(item.id, e.target.value)}
                    placeholder="https://..."
                    className="w-full px-2.5 py-1 text-xs font-mono border border-slate-200 rounded bg-slate-50 text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onCreatePostWithMedia(item)}
                  className="w-full py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                >
                  Queue Post with Photo
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
