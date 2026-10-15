import { describe, expect, it } from 'vitest';
import { episodesPagePath, paginateList } from '../../src/lib/pagination.ts';

describe('pagination', () => {
  it('découpe en pages complètes puis le reste', () => {
    const pages = paginateList([1, 2, 3, 4, 5], 2);
    expect(pages.map((page) => page.items)).toEqual([[1, 2], [3, 4], [5]]);
    expect(pages.every((page) => page.total === 3)).toBe(true);
    expect(pages.map((page) => page.number)).toEqual([1, 2, 3]);
  });

  it('garde une page vide quand il n’y a encore rien', () => {
    expect(paginateList([], 24)).toEqual([{ number: 1, total: 1, items: [] }]);
  });

  it('refuse une taille de page invalide', () => {
    expect(() => paginateList([1], 0)).toThrow();
  });

  it('donne l’adresse de chaque page', () => {
    expect(episodesPagePath(1)).toBe('/episodes/');
    expect(episodesPagePath(3)).toBe('/episodes/page/3/');
  });
});
