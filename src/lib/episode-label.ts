// Libellé d'un épisode : « Épisode 3 » ou, pour un numéro spécial (documentaire de ~30 min), « Numéro spécial n° 1 ».
// Les numéros spéciaux gardent un `number` unique, à partir de 101 (hs01 → 101), pour ne pas décaler la
// numérotation des épisodes ordinaires.

/** Premier numéro réservé aux numéros spéciaux (hs01 → 101). */
export const SPECIAL_OFFSET = 100;

interface Numbered {
  number: number;
  special?: boolean | undefined;
}

/** « Épisode 3 » ou « Numéro spécial n° 1 ». */
export function episodeLabel(data: Numbered): string {
  return data.special ? `Numéro spécial n° ${data.number - SPECIAL_OFFSET}` : `Épisode ${data.number}`;
}

/** Même libellé, en minuscule initiale (au milieu d'une phrase). */
export function episodeLabelLower(data: Numbered): string {
  const label = episodeLabel(data);
  return label.charAt(0).toLowerCase() + label.slice(1);
}
