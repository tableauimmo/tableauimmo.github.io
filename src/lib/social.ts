// Images de partage (Open Graph / réseaux sociaux) : 1200×630.
// Images fixes : public/og/<nom>.jpg, générées par scripts/assets/build_og.py (npm run assets:og).
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { OgName } from '../data/og.ts';

export { OG_IMAGES, type OgName } from '../data/og.ts';

export interface SocialImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;

export function ogImage(name: OgName, alt: string): SocialImage {
  return { url: `/og/${name}.jpg`, width: SOCIAL_WIDTH, height: SOCIAL_HEIGHT, alt };
}

/** Miniature 16:9 (vignette d'épisode) en JPEG, utilisée pour le partage et les données structurées. */
export async function thumbnailImage(src: ImageMetadata, alt: string): Promise<SocialImage> {
  const width = Math.min(1280, src.width);
  const height = Math.round((width * 9) / 16);
  const image = await getImage({ src, width, height, format: 'jpg', quality: 84, fit: 'cover' });
  return { url: image.src, width, height, alt };
}
