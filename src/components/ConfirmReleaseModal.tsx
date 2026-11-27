import React from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';
import { DispatchMode, MediaAsset, QueuePost } from '../types';
import { getCharDiagnostics } from '../services/snipEngine';

interface ConfirmReleaseModalProps {
  post: QueuePost | null;
  media?: MediaAsset;
  dispatchMode: DispatchMode;
  onCancel: () => void;
  onConfirm: (post: QueuePost) => void;
}

export const ConfirmReleaseModal: React.FC<ConfirmReleaseModalProps> = ({
  post,
  media,
  dispatchMode,
  onCancel,
  onConfirm,
}) => {
  if (!post) return null;

  const diagnostics = getCharDiagnostics(post.text, post.platforms);
  const hasOverLimit = diagnostics.some((d) => d.overLimit);
  const needsPublicUrlForIg =
    dispatchMode === 'official' &&
    post.platforms.includes('instagram') &&
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
            {dispatchMode === 'dry-run'
              ? 'Simulate Single-Post Release'
              : dispatchMode === 'webhook'
                ? 'Confirm Webhook Bridge Dispatch'
                : 'Confirm Live Social Release'}
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
            {dispatchMode === 'dry-run'
              ? 'Payload Dry-Run mode is active. This will simulate sending one post and log the exact official API endpoints without publishing externally.'
              : dispatchMode === 'webhook'
                ? 'Webhook Bridge mode is active. This will send the post JSON payload to your configured automation webhook.'
                : 'This will immediately publish this single post through the configured official public APIs.'}
          </p>

          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 text-sm text-slate-800 whitespace-pre-wrap max-h-44 overflow-y-auto">
            {post.text}
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800">Targets:</span>
            <span>{post.platforms.join(' · ') || 'None selected'}</span>
            {media && (
              <>
                <span aria-hidden="true">·</span>
                <span>Image: {media.name}</span>
              </>
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
            onClick={() => onConfirm(post)}
            disabled={post.platforms.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {dispatchMode === 'dry-run'
                ? 'Run Simulation'
                : dispatchMode === 'webhook'
                  ? 'Send via Webhook'
                  : 'Publish Post Now'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
