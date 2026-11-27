import React, { useMemo, useRef, useState } from 'react';
import { FilePlus2, FileText, Scissors, Trash2, Upload } from 'lucide-react';
import { MarkdownDoc } from '../types';

interface RepositoryViewProps {
  docs: MarkdownDoc[];
  onUploadFiles: (files: FileList) => void;
  onAddDoc: (title: string, content: string) => void;
  onUpdateDoc: (id: string, patch: Partial<MarkdownDoc>) => void;
  onDeleteDoc: (id: string) => void;
  onSnipSelectedToQueue: () => void;
  onNavigateMedia: () => void;
}

export const RepositoryView: React.FC<RepositoryViewProps> = ({
  docs,
  onUploadFiles,
  onAddDoc,
  onUpdateDoc,
  onDeleteDoc,
  onSnipSelectedToQueue,
  onNavigateMedia,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(docs[0]?.id || null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState(
    '## First Post Idea\n\nWrite your Markdown note here.\n\n---\n\n## Second Post Idea\n\nSeparate snippets with --- or headings.'
  );

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeDocId) || docs[0] || null,
    [docs, activeDocId]
  );

  const selectedCount = docs.filter((d) => d.selected).length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    onAddDoc(newTitle.trim(), newContent);
    setNewTitle('');
    setCreatingNew(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Markdown Repository
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Upload local .md files, draft notes directly, or sync folders from Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreatingNew((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>New Draft</span>
          </button>
          <button
            type="button"
            onClick={onNavigateMedia}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <span>Sync Drive Folder</span>
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onSnipSelectedToQueue}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
          >
            <Scissors className="w-4 h-4" />
            <span>Snip &amp; Queue Selected ({selectedCount})</span>
          </button>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border border-dashed rounded-xl p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-600 bg-blue-50/60'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUploadFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-900">
          Drop one or more <code className="font-mono text-xs">.md</code> files here
        </p>
        <p className="text-xs text-slate-500 mt-1 mb-3">
          Processed locally in your browser with zero server uploads.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
        >
          Browse Markdown Files
        </button>
      </div>

      {creatingNew && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Create New Markdown Document
            </h2>
            <button
              type="button"
              onClick={() => setCreatingNew(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            required
            placeholder="Filename (e.g. Weekly_Product_Notes)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
          <textarea
            rows={7}
            required
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Save to Repository
            </button>
          </div>
        </form>
      )}

      {/* Repository Table + Live Markdown Source Editor */}
      {docs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-slate-900">Repository is empty</p>
          <p className="text-xs text-slate-500 mt-1">
            Upload a .md file above or sync a Google Drive folder to start snipping posts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {docs.map((doc) => {
              const isActive = activeDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  className={`p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    isActive ? 'bg-blue-50/45' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={doc.selected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateDoc(doc.id, { selected: e.target.checked })}
                      aria-label={`Select ${doc.filename}`}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 truncate">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{doc.filename}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="capitalize">{doc.source}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{doc.content.length} chars</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDoc(doc.id);
                    }}
                    aria-label={`Delete ${doc.filename}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {activeDoc && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {activeDoc.filename}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Source: {activeDoc.source} · Updated{' '}
                    {new Date(activeDoc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {activeDoc.content.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              <textarea
                rows={16}
                value={activeDoc.content}
                onChange={(e) =>
                  onUpdateDoc(activeDoc.id, {
                    content: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                aria-label={`Edit content of ${activeDoc.filename}`}
                className="w-full p-3 text-sm font-mono leading-relaxed border border-slate-200 rounded-lg bg-slate-50/50 text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
