import studioDeskUrl from '../assets/images/sample_studio_desk_1795755973808.jpg';
import architectureUrl from '../assets/images/sample_modern_architecture_1795755973972.jpg';
import coastalUrl from '../assets/images/sample_coastal_horizon_1795755975376.jpg';
import { MarkdownDoc, MediaAsset, QueuePost, ScheduleConfig, SnipRule } from '../types';

export const STARTER_DOCS: MarkdownDoc[] = [
  {
    id: 'sample-doc-1',
    title: 'Field_Notes_Calm_Software',
    filename: 'Field_Notes_Calm_Software.md',
    source: 'sample',
    updatedAt: '2026-11-26T18:00:00.000Z',
    selected: true,
    content: `---
author: Editorial Studio
topic: Product Craft
---

## Why Plain Text Still Wins

Good publishing tools stay out of the way. Keep your drafts in plain Markdown files, separate writing from distribution, and let small automated rules shape each excerpt before it hits your queue.

---

## Designing for Quiet Focus

Most interfaces confuse visual density with usefulness. Strip away unnecessary badges, align your typography on a clear grid, and make the next single action unmistakable.

---

## One Post at a Time

Batch scheduling does not mean blind broadcasting. Previewing each snippet one post at a time ensures tone, image framing, and character budgets hold up across X, Instagram, and Facebook.`,
  },
  {
    id: 'sample-doc-2',
    title: 'Architecture_Light_Journal',
    filename: 'Architecture_Light_Journal.md',
    source: 'sample',
    updatedAt: '2026-11-26T19:15:00.000Z',
    selected: true,
    content: `# Concrete & Afternoon Sun

> Materials age best when light is treated as a structural element rather than an afterthought.

Late-afternoon sun cuts clean geometry across raw concrete facades. When photographing spaces, wait for the 20-minute window when glass reflects sky rather than interior clutter.

## Coastal Field Study

Dawn fog softens every edge along the shoreline. Muted palettes give short captions room to breathe on visual feeds.`,
  },
];

export const STARTER_RULES: SnipRule[] = [
  {
    id: 'rule-hr-sections',
    name: 'Horizontal Rule Blocks (---)',
    mode: 'hr',
    headingLevel: 2,
    customDelimiter: '<!-- post -->',
    stripFrontmatter: true,
    stripMarkdown: true,
    includeHeading: true,
    minChars: 24,
    maxChars: 280,
    targetLength: 240,
    includeKeyword: '',
    excludeKeyword: '',
    appendText: '#Writing #Markdown',
    autoPairImages: true,
    defaultPlatforms: ['twitter', 'facebook'],
    enabled: true,
  },
  {
    id: 'rule-h2-headings',
    name: 'H2 Section Excerpts (##)',
    mode: 'headings',
    headingLevel: 2,
    customDelimiter: '<!-- post -->',
    stripFrontmatter: true,
    stripMarkdown: true,
    includeHeading: false,
    minChars: 24,
    maxChars: 2100,
    targetLength: 240,
    includeKeyword: '',
    excludeKeyword: '',
    appendText: '',
    autoPairImages: true,
    defaultPlatforms: ['instagram', 'facebook'],
    enabled: true,
  },
  {
    id: 'rule-blockquotes',
    name: 'Pull Quotes (> Quote)',
    mode: 'blockquotes',
    headingLevel: 2,
    customDelimiter: '<!-- post -->',
    stripFrontmatter: true,
    stripMarkdown: true,
    includeHeading: false,
    minChars: 15,
    maxChars: 260,
    targetLength: 240,
    includeKeyword: '',
    excludeKeyword: '',
    appendText: '',
    autoPairImages: false,
    defaultPlatforms: ['twitter'],
    enabled: true,
  },
];

export const STARTER_MEDIA: MediaAsset[] = [
  {
    id: 'sample-img-desk',
    name: 'studio_desk_morning.jpg',
    source: 'sample',
    url: studioDeskUrl,
    mimeType: 'image/jpeg',
    createdAt: '2026-11-26T18:00:00.000Z',
  },
  {
    id: 'sample-img-arch',
    name: 'gallery_facade_sunlight.jpg',
    source: 'sample',
    url: architectureUrl,
    mimeType: 'image/jpeg',
    createdAt: '2026-11-26T18:10:00.000Z',
  },
  {
    id: 'sample-img-coast',
    name: 'coastal_dawn_horizon.jpg',
    source: 'sample',
    url: coastalUrl,
    mimeType: 'image/jpeg',
    createdAt: '2026-11-26T18:20:00.000Z',
  },
];

export const STARTER_QUEUE: QueuePost[] = [
  {
    id: 'q-starter-1',
    text: 'Why Plain Text Still Wins\n\nGood publishing tools stay out of the way. Keep your drafts in plain Markdown files, separate writing from distribution, and let small automated rules shape each excerpt before it hits your queue.\n\n#Writing #Markdown',
    sourceDocId: 'sample-doc-1',
    sourceDocTitle: 'Field_Notes_Calm_Software',
    ruleName: 'Horizontal Rule Blocks (---)',
    platforms: ['twitter', 'facebook'],
    mediaId: 'sample-img-desk',
    status: 'queued',
    order: 0,
  },
  {
    id: 'q-starter-2',
    text: 'Late-afternoon sun cuts clean geometry across raw concrete facades. When photographing spaces, wait for the 20-minute window when glass reflects sky rather than interior clutter.',
    sourceDocId: 'sample-doc-2',
    sourceDocTitle: 'Architecture_Light_Journal',
    ruleName: 'H2 Section Excerpts (##)',
    platforms: ['instagram', 'facebook'],
    mediaId: 'sample-img-arch',
    status: 'queued',
    order: 1,
  },
  {
    id: 'q-starter-3',
    text: 'Dawn fog softens every edge along the shoreline. Muted palettes give short captions room to breathe on visual feeds.',
    sourceDocId: 'sample-doc-2',
    sourceDocTitle: 'Architecture_Light_Journal',
    ruleName: 'H2 Section Excerpts (##)',
    platforms: ['twitter', 'instagram'],
    mediaId: 'sample-img-coast',
    status: 'scheduled',
    scheduledAt: '2026-11-27T09:00',
    order: 2,
  },
];

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  enabled: false,
  mode: 'interval',
  intervalMinutes: 120,
  dailyTimes: ['09:00', '13:30', '18:00'],
  activeWindowStart: '08:00',
  activeWindowEnd: '21:00',
  respectActiveWindow: true,
};
