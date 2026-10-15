import { describe, expect, it } from 'vitest';
import { SITE } from '../../site.config.mjs';
import { collator, formatDate, initialOf, pageTitle, TITLE_MAX } from '../../src/lib/format.ts';
import { absoluteUrl, href } from '../../src/lib/url.ts';

describe('adresses', () => {
  it('liens internes et URL absolues à partir de site.config.mjs', () => {
    expect(SITE.base).toBe('/');
    expect(href('/outils/')).toBe('/outils/');
    expect(href('https://exemple.fr/')).toBe('https://exemple.fr/');
    expect(absoluteUrl('/lexique/lmnp/')).toBe(`${SITE.url}/lexique/lmnp/`);
    expect(absoluteUrl('https://www.youtube.com/')).toBe('https://www.youtube.com/');
  });
});

describe('formats', () => {
  it('dates longues en français, avec « 1er »', () => {
    expect(formatDate(new Date('2026-10-15T12:00:00Z'))).toBe('15 octobre 2026');
    expect(formatDate(new Date('2026-10-01T12:00:00Z'))).toBe('1er octobre 2026');
  });

  it('ajoute la marque au titre seulement s’il reste lisible', () => {
    expect(pageTitle('Le lexique')).toBe('Le lexique | Tableau Immo');
    const long = 'Calculateur de rendement locatif brut et net avec charges et vacance';
    expect(pageTitle(long)).toBe(long);
    expect(pageTitle('Tableau Immo — accueil')).toBe('Tableau Immo — accueil');
    expect(TITLE_MAX).toBe(70);
  });

  it('index alphabétique sans accents', () => {
    expect(initialOf('Écart')).toBe('E');
    expect(initialOf('« DPE »')).toBe('#');
    expect(['viager', 'Apport', 'écart'].sort(collator.compare)).toEqual(['Apport', 'écart', 'viager']);
  });
});
