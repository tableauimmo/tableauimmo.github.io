// Fichiers de la routine (dossier visibilite/) : lecture validée, écriture lisible et versionnable.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'astro/zod';
import {
  configSchema,
  experimentsSchema,
  geoSchema,
  SNAPSHOT_VERSION,
  snapshotSchema,
  targetsSchema,
  type Evaluation,
  type Experiment,
  type GeoProbe,
  type Snapshot,
  type Targets,
  type VisibilityConfig,
} from './schema.ts';

export const DATA_DIR = 'visibilite';
const SNAPSHOT_FILE = /^\d{4}-\d{2}-\d{2}_\d{4}\.json$/;
const GEO_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

export async function readJson<T extends z.ZodType>(file: string, schema: T): Promise<z.infer<T>> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    throw new Error(`Fichier introuvable : ${file}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file} : JSON invalide (${error instanceof Error ? error.message : String(error)})`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`).join(' ; ');
    throw new Error(`${file} invalide : ${details}`);
  }
  return parsed.data;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export const loadConfig = (dir: string): Promise<VisibilityConfig> => readJson(path.join(dir, 'config.json'), configSchema);
export const loadTargets = (dir: string): Promise<Targets> => readJson(path.join(dir, 'cibles.json'), targetsSchema);

export async function loadExperiments(dir: string): Promise<Experiment[]> {
  return (await readJson(path.join(dir, 'experiences.json'), experimentsSchema)).experiences;
}

export async function saveExperiments(dir: string, experiences: Experiment[]): Promise<void> {
  experimentsSchema.parse({ experiences });
  await writeJson(path.join(dir, 'experiences.json'), { experiences });
}

async function newestFile(dir: string, pattern: RegExp): Promise<string | null> {
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((file) => pattern.test(file)).sort();
  const newest = files.at(-1);
  return newest ? path.join(dir, newest) : null;
}

/** Dernier sondage GEO enregistré (visibilite/geo/AAAA-MM-JJ.json), s'il y en a un. */
export async function latestGeo(dir: string): Promise<GeoProbe | null> {
  const file = await newestFile(path.join(dir, 'geo'), GEO_FILE);
  return file ? readJson(file, geoSchema) : null;
}

/** Version d'un instantané enregistré (sans valider le reste du fichier). */
export async function snapshotVersion(file: string): Promise<unknown> {
  const json: unknown = JSON.parse(await readFile(file, 'utf8'));
  return typeof json === 'object' && json !== null ? (json as { version?: unknown }).version : undefined;
}

/**
 * Dernier instantané comparable. Un instantané d'une autre version du format est ignoré (avec un avertissement) ;
 * un instantané de la version actuelle mais invalide est une vraie anomalie et arrête la routine.
 */
export async function latestSnapshot(dir: string): Promise<Snapshot | null> {
  const file = await newestFile(path.join(dir, 'historique'), SNAPSHOT_FILE);
  if (!file) return null;
  const version = await snapshotVersion(file);
  if (version !== SNAPSHOT_VERSION) {
    console.warn(`ℹ︎ ${path.basename(file)} est au format ${String(version)} (actuel : ${SNAPSHOT_VERSION}) : pas de comparaison avec ce passage.`);
    return null;
  }
  return readJson(file, snapshotSchema);
}

/** Horodatage UTC des fichiers d'un passage : AAAA-MM-JJ_HHMM. */
export function runStamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)}_${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

export async function saveRun(dir: string, stamp: string, snapshot: Snapshot, report: string): Promise<{ snapshotFile: string; reportFile: string }> {
  snapshotSchema.parse(snapshot);
  const snapshotFile = path.join(dir, 'historique', `${stamp}.json`);
  const reportFile = path.join(dir, 'rapports', `${stamp}.md`);
  await writeJson(snapshotFile, snapshot);
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, report, 'utf8');
  return { snapshotFile, reportFile };
}

/** Reporte dans le journal les verdicts définitifs (gagnante, neutre, perdante) des expériences arrivées à échéance. */
export function applyEvaluations(experiments: Experiment[], evaluations: Evaluation[], today: string): Experiment[] {
  const byId = new Map(evaluations.map((evaluation) => [evaluation.id, evaluation]));
  return experiments.map((experiment) => {
    const evaluation = byId.get(experiment.id);
    if (experiment.statut !== 'en-cours' || !evaluation) return experiment;
    if (evaluation.verdict !== 'gagnante' && evaluation.verdict !== 'neutre' && evaluation.verdict !== 'perdante') return experiment;
    return {
      ...experiment,
      statut: evaluation.verdict,
      resultat: { date: today, apres: evaluation.apres, variation: evaluation.variation, commentaire: evaluation.commentaire },
    };
  });
}
