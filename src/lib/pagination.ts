// Découpage d'une liste en pages (liste des épisodes : la série grandit chaque semaine).
export const EPISODES_PER_PAGE = 12;

export interface Page<T> {
  /** Numéro de page, à partir de 1 */
  number: number;
  total: number;
  items: T[];
}

export function paginateList<T>(items: readonly T[], pageSize: number): Page<T>[] {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error(`Taille de page invalide : ${pageSize}`);
  const total = Math.max(1, Math.ceil(items.length / pageSize));
  return Array.from({ length: total }, (_, index) => ({
    number: index + 1,
    total,
    items: items.slice(index * pageSize, (index + 1) * pageSize),
  }));
}

/** Adresse d'une page de la liste des épisodes (la page 1 est /episodes/). */
export function episodesPagePath(number: number): string {
  return number <= 1 ? '/episodes/' : `/episodes/page/${number}/`;
}
