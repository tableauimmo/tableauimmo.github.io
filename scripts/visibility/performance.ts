// Performance mobile des pages clés : PageSpeed Insights (avec clé Google : laboratoire + données réelles
// des visiteurs Chrome) ou, sans clé, Lighthouse lancé sur cette machine avec le Chromium des tests.
import { z } from 'astro/zod';
import { fetchWithRetry } from '../lib/http.ts';
import type { PerformanceResult } from './schema.ts';

const CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'] as const;

const scoreSchema = z.object({ score: z.number().nullable() });
const numericAuditSchema = z.object({ numericValue: z.number() });

const lighthouseResultSchema = z.object({
  categories: z.object({ performance: scoreSchema, seo: scoreSchema, accessibility: scoreSchema, 'best-practices': scoreSchema }),
  audits: z.object({
    'largest-contentful-paint': numericAuditSchema,
    'cumulative-layout-shift': numericAuditSchema,
    'total-blocking-time': numericAuditSchema,
  }),
});

const fieldMetricSchema = z.object({ percentile: z.number() }).optional();
const loadingExperienceSchema = z
  .object({
    overall_category: z.string().optional(),
    metrics: z
      .object({
        LARGEST_CONTENTFUL_PAINT_MS: fieldMetricSchema,
        INTERACTION_TO_NEXT_PAINT: fieldMetricSchema,
        CUMULATIVE_LAYOUT_SHIFT_SCORE: fieldMetricSchema,
      })
      .optional(),
  })
  .optional();

const toPercent = (score: number | null) => Math.round((score ?? 0) * 100);

export function parseLighthouseResult(lhr: unknown, url: string, source: PerformanceResult[number]['source']): PerformanceResult[number] {
  const parsed = lighthouseResultSchema.safeParse(lhr);
  if (!parsed.success) throw new Error(`Résultat Lighthouse inattendu pour ${url}`);
  const { categories, audits } = parsed.data;
  return {
    source,
    url,
    scores: {
      performance: toPercent(categories.performance.score),
      seo: toPercent(categories.seo.score),
      accessibilite: toPercent(categories.accessibility.score),
      bonnesPratiques: toPercent(categories['best-practices'].score),
    },
    lcpMs: Math.round(audits['largest-contentful-paint'].numericValue),
    cls: Number(audits['cumulative-layout-shift'].numericValue.toFixed(3)),
    tbtMs: Math.round(audits['total-blocking-time'].numericValue),
  };
}

export function parsePageSpeed(payload: unknown, url: string): PerformanceResult[number] {
  const { lighthouseResult, loadingExperience } = z.object({ lighthouseResult: z.unknown(), loadingExperience: z.unknown() }).parse(payload);
  const result = parseLighthouseResult(lighthouseResult, url, 'pagespeed');
  const field = loadingExperienceSchema.safeParse(loadingExperience);
  const metrics = field.success ? field.data?.metrics : undefined;
  if (!field.success || !field.data?.overall_category || !metrics) return result;
  return {
    ...result,
    terrain: {
      categorie: field.data.overall_category,
      ...(metrics.LARGEST_CONTENTFUL_PAINT_MS ? { lcpMs: metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile } : {}),
      ...(metrics.INTERACTION_TO_NEXT_PAINT ? { inpMs: metrics.INTERACTION_TO_NEXT_PAINT.percentile } : {}),
      ...(metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE ? { cls: metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 } : {}),
    },
  };
}

export async function runPageSpeed(urls: string[], apiKey: string): Promise<PerformanceResult> {
  const results: PerformanceResult = [];
  for (const url of urls) {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('strategy', 'mobile');
    endpoint.searchParams.set('locale', 'fr');
    for (const category of CATEGORIES) endpoint.searchParams.append('category', category.toUpperCase().replace('-', '_'));
    endpoint.searchParams.set('key', apiKey);
    const response = await fetchWithRetry(endpoint.href, { timeoutMs: 120_000, retries: 1 });
    results.push(parsePageSpeed(await response.json(), url));
  }
  return results;
}

/** Lighthouse local (profil mobile par défaut : écran de téléphone, réseau et processeur ralentis). */
export async function runLighthouseLocal(urls: string[]): Promise<PerformanceResult> {
  // Lighthouse n'est pas une dépendance du projet (lourde) : à installer à la demande.
  const lighthouseModule: string = 'lighthouse';
  const launcherModule: string = 'chrome-launcher';
  let modules: [any, any];
  try {
    modules = await Promise.all([import(lighthouseModule), import(launcherModule)]);
  } catch {
    throw new Error('Lighthouse local indisponible : lancer « npm install --no-save lighthouse chrome-launcher », ou définir GOOGLE_API_KEY (PageSpeed Insights).');
  }
  const [{ default: lighthouse }, { launch }] = modules;
  const { chromium } = await import('@playwright/test');
  const localChromium = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
  const { existsSync } = await import('node:fs');
  const chromePath = existsSync(localChromium) ? localChromium : chromium.executablePath();
  const chrome = await launch({ chromePath, chromeFlags: ['--headless=new', '--no-first-run'], logLevel: 'silent' });
  try {
    const results: PerformanceResult = [];
    for (const url of urls) {
      const run: { lhr: { runtimeError?: { code: string } } & Record<string, unknown> } | undefined = await lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: [...CATEGORIES],
      });
      if (!run) throw new Error(`Lighthouse n'a rien renvoyé pour ${url}`);
      if (run.lhr.runtimeError) throw new Error(`Lighthouse : ${run.lhr.runtimeError.code} sur ${url}`);
      results.push(parseLighthouseResult(run.lhr, url, 'lighthouse-local'));
    }
    return results;
  } finally {
    chrome.kill();
  }
}
