import { describe, expect, it } from 'vitest';
import {
  cleanVideoTitle,
  durationToSeconds,
  embedUrl,
  formatDuration,
  formatDurationShort,
  formatTimestamp,
  normalizeForMatch,
  parseChapters,
  parseYouTubeId,
  slugify,
  timestampToSeconds,
} from '../../src/lib/youtube.ts';

describe('parseYouTubeId', () => {
  it.each([
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reconnaît %s', (input, expected) => {
    expect(parseYouTubeId(input)).toBe(expected);
  });

  it.each(['', 'pas une url', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/court', 'https://www.youtube.com/@TableauImmo'])('refuse « %s »', (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});

describe('titres et slugs', () => {
  it('retire le suffixe de chaîne, les emoji et les hashtags', () => {
    expect(cleanVideoTitle('LMNP en 2026 : ce qui change | Tableau Immo')).toBe('LMNP en 2026 : ce qui change');
    expect(cleanVideoTitle('Le piège du rendement 📉 #immobilier #shorts')).toBe('Le piège du rendement');
  });

  it('normalise accents, casse et ponctuation', () => {
    expect(normalizeForMatch('Déficit FONCIER : 10 700 € !')).toBe('deficit foncier 10 700');
    expect(slugify('SCI à l’IS ou à l’IR ?')).toBe('sci-a-l-is-ou-a-l-ir');
  });
});

describe('chapitres', () => {
  it('lit les horodatages au format YouTube', () => {
    const description = "Intro du texte\n0:00 L'accroche\n0:28 Le micro-BIC\n3:15 - La revente\n1:02:03 Bonus\nhttps://lien";
    expect(parseChapters(description)).toEqual([
      { t: '0:00', title: "L'accroche" },
      { t: '0:28', title: 'Le micro-BIC' },
      { t: '3:15', title: 'La revente' },
      { t: '1:02:03', title: 'Bonus' },
    ]);
  });

  it('ignore les chapitres non conformes aux règles YouTube', () => {
    expect(parseChapters('0:15 A\n0:30 B\n0:45 C')).toEqual([]);
    expect(parseChapters('0:00 A\n0:30 B')).toEqual([]);
    expect(parseChapters('0:00 A\n0:30 B\n0:20 C')).toEqual([]);
  });

  it('convertit les horodatages', () => {
    expect(timestampToSeconds('0:32')).toBe(32);
    expect(timestampToSeconds('10:05')).toBe(605);
    expect(timestampToSeconds('1:02:03')).toBe(3723);
    expect(() => timestampToSeconds('0:75')).toThrow();
    expect(() => timestampToSeconds('abc')).toThrow();
    expect(formatTimestamp(65)).toBe('1:05');
    expect(formatTimestamp(3723)).toBe('1:02:03');
  });
});

describe('durées', () => {
  it('convertit et formate', () => {
    expect(durationToSeconds('PT10M24S')).toBe(624);
    expect(durationToSeconds('PT1H2M3S')).toBe(3723);
    expect(formatDuration('PT10M24S')).toBe('10 min 24 s');
    expect(formatDuration('PT10M')).toBe('10 min');
    expect(formatDurationShort('PT10M24S')).toBe('10 min');
    expect(() => durationToSeconds('10 minutes')).toThrow();
  });
});

describe('lecteur', () => {
  it('utilise le domaine sans cookies, le point de départ et la lecture automatique', () => {
    expect(embedUrl('dQw4w9WgXcQ')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    expect(embedUrl('dQw4w9WgXcQ', { start: 90, autoplay: true })).toContain('start=90');
    expect(embedUrl('dQw4w9WgXcQ', { start: 90, autoplay: true })).toContain('autoplay=1');
  });
});
