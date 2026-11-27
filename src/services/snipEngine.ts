import { MarkdownDoc, SnipCandidate, SnipRule, SocialPlatform } from '../types';

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
};

export function stripYamlFrontmatter(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return normalized;
  const endIdx = normalized.indexOf('\n---\n', 4);
  if (endIdx === -1) return normalized;
  return normalized.slice(endIdx + 5).trimStart();
}

export function cleanMarkdownToPlainText(markdown: string): string {
  let out = markdown.replace(/\r\n/g, '\n');

  // Remove code fence markers while preserving inner text
  out = out.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, '$1');
  // Replace Markdown links [text](url) -> text (url) or text if same
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const cleanLabel = label.trim();
    if (cleanLabel === url || cleanLabel.startsWith('http')) return url;
    return `${cleanLabel} (${url})`;
  });
  // Remove image markdown ![alt](url)
  out = out.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  // Strip heading prefixes
  out = out.replace(/^#{1,6}\s+/gm, '');
  // Strip blockquote markers
  out = out.replace(/^>\s?/gm, '');
  // Strip bold/italic/strikethrough/inline code
  out = out.replace(/(\*\*|__)(.*?)\1/g, '$2');
  out = out.replace(/(\*|_)(.*?)\1/g, '$2');
  out = out.replace(/~~(.*?)~~/g, '$1');
  out = out.replace(/`([^`]+)`/g, '$1');
  // Collapse excessive blank lines
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  return out;
}

function splitBySentenceBudget(text: string, budget: number): string[] {
  const safeBudget = Math.max(60, budget);
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= safeBudget) {
      chunks.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [para];
    let current = '';
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
      if (candidate.length <= safeBudget) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        if (sentence.trim().length <= safeBudget) {
          current = sentence.trim();
        } else {
          // Hard word-boundary split for oversized single sentence
          const words = sentence.trim().split(/\s+/);
          let line = '';
          for (const w of words) {
            const next = line ? `${line} ${w}` : w;
            if (next.length <= safeBudget) {
              line = next;
            } else {
              if (line) chunks.push(line);
              line = w;
            }
          }
          current = line;
        }
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

interface RawSegment {
  raw: string;
  heading?: string;
}

function extractRawSegments(content: string, rule: SnipRule): RawSegment[] {
  const body = rule.stripFrontmatter ? stripYamlFrontmatter(content) : content.replace(/\r\n/g, '\n');

  if (rule.mode === 'hr') {
    return body
      .split(/\n(?:---|\*\*\*|___)\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((raw) => ({ raw }));
  }

  if (rule.mode === 'delimiter') {
    const delim = rule.customDelimiter.trim() || '<!-- post -->';
    return body
      .split(delim)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((raw) => ({ raw }));
  }

  if (rule.mode === 'blockquotes') {
    const lines = body.split('\n');
    const quotes: RawSegment[] = [];
    let buffer: string[] = [];
    for (const line of lines) {
      if (/^\s*>/.test(line)) {
        buffer.push(line);
      } else if (buffer.length > 0) {
        quotes.push({ raw: buffer.join('\n') });
        buffer = [];
      }
    }
    if (buffer.length > 0) quotes.push({ raw: buffer.join('\n') });
    return quotes;
  }

  if (rule.mode === 'headings') {
    const hashes = '#'.repeat(rule.headingLevel);
    const regex = new RegExp(`^(${hashes})\\s+(.+)$`, 'gm');
    const matches = [...body.matchAll(regex)];
    if (matches.length === 0) {
      return body.trim() ? [{ raw: body.trim() }] : [];
    }
    const segments: RawSegment[] = [];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const start = m.index ?? 0;
      const headingLineEnd = body.indexOf('\n', start);
      const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? body.length) : body.length;
      const headingText = m[2].trim();
      const sectionBody =
        headingLineEnd === -1 ? '' : body.slice(headingLineEnd + 1, nextStart).trim();
      const raw = rule.includeHeading
        ? `${m[1]} ${headingText}\n\n${sectionBody}`.trim()
        : sectionBody;
      if (raw) {
        segments.push({ raw, heading: headingText });
      }
    }
    return segments;
  }

  if (rule.mode === 'paragraphs') {
    return body
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0 && !/^#{1,6}\s/.test(block))
      .map((raw) => ({ raw }));
  }

  // 'chunk' mode: sentence-boundary budget splitting
  const cleanedForChunk = rule.stripMarkdown ? cleanMarkdownToPlainText(body) : body;
  return splitBySentenceBudget(cleanedForChunk, rule.targetLength).map((raw) => ({ raw }));
}

export function applySnipRule(doc: MarkdownDoc, rule: SnipRule): SnipCandidate[] {
  if (!rule.enabled) return [];

  const segments = extractRawSegments(doc.content, rule);
  const candidates: SnipCandidate[] = [];

  const includeTerms = rule.includeKeyword
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const excludeTerms = rule.excludeKeyword
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  segments.forEach((seg, idx) => {
    let text = rule.stripMarkdown ? cleanMarkdownToPlainText(seg.raw) : seg.raw.trim();
    if (!text) return;

    if (rule.appendText.trim()) {
      text = `${text}\n\n${rule.appendText.trim()}`;
    }

    const lower = text.toLowerCase();
    if (includeTerms.length > 0 && !includeTerms.some((term) => lower.includes(term))) {
      return;
    }
    if (excludeTerms.length > 0 && excludeTerms.some((term) => lower.includes(term))) {
      return;
    }

    if (text.length < rule.minChars) return;

    if (rule.maxChars > 0 && text.length > rule.maxChars) {
      const clipped = text.slice(0, Math.max(10, rule.maxChars - 1)).trimEnd();
      const lastSpace = clipped.lastIndexOf(' ');
      text = `${lastSpace > rule.maxChars * 0.6 ? clipped.slice(0, lastSpace) : clipped}…`;
    }

    candidates.push({
      id: `${doc.id}::${rule.id}::${idx}`,
      docId: doc.id,
      docTitle: doc.title,
      index: candidates.length + 1,
      text,
      rawMarkdown: seg.raw,
      heading: seg.heading,
      charCount: text.length,
      ruleId: rule.id,
      ruleName: rule.name,
    });
  });

  return candidates;
}

export function getCharDiagnostics(text: string, platforms: SocialPlatform[]) {
  return platforms.map((platform) => {
    const limit = PLATFORM_CHAR_LIMITS[platform];
    return {
      platform,
      count: text.length,
      limit,
      overLimit: text.length > limit,
    };
  });
}
