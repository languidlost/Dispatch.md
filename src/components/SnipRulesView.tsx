import React, { useMemo, useState } from 'react';
import { Plus, Scissors, Send, Trash2 } from 'lucide-react';
import {
  MarkdownDoc,
  SnipCandidate,
  SnipMode,
  SnipRule,
  SocialPlatform,
} from '../types';
import { applySnipRule } from '../services/snipEngine';

interface SnipRulesViewProps {
  docs: MarkdownDoc[];
  rules: SnipRule[];
  onAddRule: () => void;
  onUpdateRule: (id: string, patch: Partial<SnipRule>) => void;
  onDeleteRule: (id: string) => void;
  onQueueCandidates: (candidates: SnipCandidate[], rule: SnipRule) => void;
}

const MODE_OPTIONS: Array<{ value: SnipMode; label: string; hint: string }> = [
  { value: 'hr', label: 'Horizontal Rules (---)', hint: 'Splits on --- or *** separators' },
  { value: 'headings', label: 'Markdown Headings', hint: 'Extracts each # / ## / ### section' },
  { value: 'paragraphs', label: 'Paragraphs', hint: 'Each non-heading paragraph becomes a post' },
  { value: 'blockquotes', label: 'Blockquotes (>)', hint: 'Pulls quoted callout lines only' },
  { value: 'delimiter', label: 'Custom Delimiter', hint: 'Splits on a custom marker token' },
  { value: 'chunk', label: 'Sentence Budget', hint: 'Chunks prose cleanly by max character target' },
];

export const SnipRulesView: React.FC<SnipRulesViewProps> = ({
  docs,
  rules,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onQueueCandidates,
}) => {
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id || '');
  const [previewDocScope, setPreviewDocScope] = useState<string>('all_selected');

  const activeRule = useMemo(
    () => rules.find((r) => r.id === selectedRuleId) || rules[0] || null,
    [rules, selectedRuleId]
  );

  const previewDocs = useMemo(() => {
    if (previewDocScope === 'all_selected') {
      return docs.filter((d) => d.selected);
    }
    return docs.filter((d) => d.id === previewDocScope);
  }, [docs, previewDocScope]);

  const candidates = useMemo(() => {
    if (!activeRule) return [];
    const previewRule: SnipRule = { ...activeRule, enabled: true };
    return previewDocs.flatMap((doc) => applySnipRule(doc, previewRule));
  }, [activeRule, previewDocs]);

  const toggleRulePlatform = (rule: SnipRule, platform: SocialPlatform) => {
    const exists = rule.defaultPlatforms.includes(platform);
    const next = exists
      ? rule.defaultPlatforms.filter((p) => p !== platform)
      : [...rule.defaultPlatforms, platform];
    onUpdateRule(rule.id, { defaultPlatforms: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Automated Snipping Rules
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Define how text excerpts are automatically extracted, cleaned, and paired with images from your Markdown repository.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddRule}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Snipping Rule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Rule List + Editor */}
        <div className="xl:col-span-6 space-y-4">
          {/* Rule selector strip */}
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {rules.map((rule) => {
              const isSelected = activeRule?.id === rule.id;
              return (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{rule.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {MODE_OPTIONS.find((m) => m.value === rule.mode)?.label} ·{' '}
                      {rule.enabled ? 'Auto-active' : 'Manual only'}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => onUpdateRule(rule.id, { enabled: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>Enabled</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      aria-label={`Delete rule ${rule.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {activeRule && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 border-b border-slate-200 pb-3">
                Rule Configuration
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={activeRule.name}
                    onChange={(e) => onUpdateRule(activeRule.id, { name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Extraction Mode
                  </label>
                  <select
                    value={activeRule.mode}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, { mode: e.target.value as SnipMode })
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeRule.mode === 'headings' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Heading Level
                    </label>
                    <select
                      value={activeRule.headingLevel}
                      onChange={(e) =>
                        onUpdateRule(activeRule.id, {
                          headingLevel: Number(e.target.value) as 1 | 2 | 3,
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value={1}>H1 (#)</option>
                      <option value={2}>H2 (##)</option>
                      <option value={3}>H3 (###)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 pt-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeRule.includeHeading}
                      onChange={(e) =>
                        onUpdateRule(activeRule.id, { includeHeading: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Include heading line in post</span>
                  </label>
                </div>
              )}

              {activeRule.mode === 'delimiter' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Custom Split Delimiter
                  </label>
                  <input
                    type="text"
                    value={activeRule.customDelimiter}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, { customDelimiter: e.target.value })
                    }
                    placeholder="<!-- post -->"
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
              )}

              {activeRule.mode === 'chunk' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Characters Per Snippet
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={2200}
                    value={activeRule.targetLength}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, {
                        targetLength: Math.max(60, Number(e.target.value) || 240),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Min Characters
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={activeRule.minChars}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, {
                        minChars: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Max Characters (0 = no cap)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={activeRule.maxChars}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, {
                        maxChars: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Require Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={activeRule.includeKeyword}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, { includeKeyword: e.target.value })
                    }
                    placeholder="e.g. launch, design"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Exclude Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={activeRule.excludeKeyword}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, { excludeKeyword: e.target.value })
                    }
                    placeholder="e.g. draft, private"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Auto-Append Hashtags or Footer Text
                </label>
                <input
                  type="text"
                  value={activeRule.appendText}
                  onChange={(e) => onUpdateRule(activeRule.id, { appendText: e.target.value })}
                  placeholder="#Notes #Updates"
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-700">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeRule.stripFrontmatter}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, { stripFrontmatter: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Strip YAML frontmatter</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeRule.stripMarkdown}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, { stripMarkdown: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Clean Markdown syntax</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeRule.autoPairImages}
                    onChange={(e) =>
                      onUpdateRule(activeRule.id, { autoPairImages: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Auto-pair photos from library</span>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Default Platforms</span>
                <div className="flex items-center gap-4 text-xs text-slate-700">
                  {(['twitter', 'facebook', 'instagram'] as SocialPlatform[]).map((plat) => (
                    <label key={plat} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeRule.defaultPlatforms.includes(plat)}
                        onChange={() => toggleRulePlatform(activeRule, plat)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span className="capitalize">{plat === 'twitter' ? 'X' : plat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Extracted Snippets Preview */}
        <div className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Live Snipping Output
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                {candidates.length} snippet{candidates.length === 1 ? '' : 's'} matched
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={previewDocScope}
                onChange={(e) => setPreviewDocScope(e.target.value)}
                aria-label="Preview source document"
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-800 max-w-44"
              >
                <option value="all_selected">All Selected Files ({docs.filter((d) => d.selected).length})</option>
                {docs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </select>

              {activeRule && (
                <button
                  type="button"
                  disabled={candidates.length === 0}
                  onClick={() => onQueueCandidates(candidates, activeRule)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Add All to Queue</span>
                </button>
              )}
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Scissors className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-800">No snippets matched this rule</p>
              <p className="text-xs text-slate-500">
                Adjust the extraction mode, min/max length, or select a different Markdown file.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[620px] overflow-y-auto pr-1">
              {candidates.map((cand) => (
                <div key={cand.id} className="py-3.5 space-y-2 first:pt-0">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {cand.docTitle}.md · Snippet {cand.index}
                    </span>
                    <span className="font-mono tabular-nums">{cand.charCount} chars</span>
                  </div>
                  <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
                    {cand.text}
                  </p>
                  {activeRule && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onQueueCandidates([cand], activeRule)}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                      >
                        + Queue This Snippet
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
