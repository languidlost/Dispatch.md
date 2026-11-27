import React from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';
import { MediaAsset, PlatformDispatchConfig, QueuePost, SocialPlatform } from '../types';
import { getCharDiagnostics } from '../services/snipEngine';

interface ConfirmReleaseModalProps {
  post: QueuePost | null;
  onlyPlatforms?: SocialPlatform[];
  media?: MediaAsset;
  platformModes: PlatformDispatchConfig;
  onCancel: () => void;
  onConfirm: (post: QueuePost, targetPlatforms: SocialPlatform[]) => void;
}

const LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
};

export const ConfirmReleaseModal: React.FC<ConfirmReleaseModalProps> = ({
  post,
  onlyPlatforms,
  media,
  platformModes,
  onCancel,
  onConfirm,
}) => {
  if (!post) return null;

  const targetPlatforms = (onlyPlatforms || post.platforms).filter((p) => {
    if (platformModes[p] === 'skip') return false;
    if (!onlyPlatforms && post.results?.[p]?.ok) return false;
    return true;
  });

  const diagnostics = getCharDiagnostics(post.text, targetPlatforms);
  const hasOverLimit = diagnostics.some((d) => d.overLimit);
  const needsPublicUrlForIg =
    targetPlatforms.includes('instagram') &&
    platformModes.instagram === 'official' &&
    (!media || !media.publicUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-release-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="confirm-release-title" className="font-display text-base font-semibold text-slate-900">
            Confirm Single-Post Release
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Each selected channel dispatches independently according to its own mode—one channel failing or skipped will never block another.
          </p>

          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 text-sm text-slate-800 whitespace-pre-wrap max-h-44 overflow-y-auto">
            {post.text}
          </div>

          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="font-medium text-slate-800">Channels in this release:</div>
            {targetPlatforms.length === 0 ? (
              <p className="text-amber-800">
                No active un-published channels remain on this post (channels set to Skip or already published are excluded).
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {targetPlatforms.map((plat) => (
                  <div key={plat} className="px-3 py-2 flex items-center justify-between">
                    <span className="font-medium text-slate-900">{LABELS[plat]}</span>
                    <span className="font-mono text-slate-600">
                      {platformModes[plat] === 'official'
                        ? 'Live Official API'
                        : platformModes[plat] === 'composer'
                          ? 'Personal Copy & Post'
                          : platformModes[plat] === 'webhook'
                            ? 'Webhook Bridge'
                            : 'Payload Dry-Run'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {media && (
              <div className="pt-1 text-slate-500">Attached photo: {media.name}</div>
            )}
          </div>

          {(hasOverLimit || needsPublicUrlForIg) && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                {hasOverLimit && (
                  <p>
                    Text exceeds the character limit for at least one selected platform (X max 280 chars).
                  </p>
                )}
                {needsPublicUrlForIg && (
                  <p>
                    Instagram Graph API v21.0 requires a publicly reachable HTTPS image URL on the attached photo.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(post, targetPlatforms)}
            disabled={targetPlatforms.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Dispatch ({targetPlatforms.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
