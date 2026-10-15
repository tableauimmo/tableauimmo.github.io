import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { geoSchema, SNAPSHOT_VERSION, snapshotSchema } from '../../scripts/visibility/schema.ts';
import { DATA_DIR, loadConfig, loadExperiments, loadTargets, readJson, snapshotVersion } from '../../scripts/visibility/storage.ts';

// Les fichiers de la routine sont modifiés par l'IA à chaque passage : un format cassé doit bloquer la vérification.
describe('données de la routine de visibilité', () => {
  it('configuration, cibles et journal des expériences sont valides', async () => {
    const config = await loadConfig(DATA_DIR);
    expect(config.searchConsoleProperty).toMatch(/^(sc-domain:|https:\/\/)/);
    const targets = await loadTargets(DATA_DIR);
    expect(targets.requetes.length).toBeGreaterThan(0);
    expect(targets.prompts.length).toBeGreaterThan(0);
    await expect(loadExperiments(DATA_DIR)).resolves.toBeInstanceOf(Array);
  });

  it('la clé IndexNow est servie à la racine du site (public/<clé>.txt)', async () => {
    const { indexNowKey } = await loadConfig(DATA_DIR);
    expect((await readFile(path.join('public', `${indexNowKey}.txt`), 'utf8')).trim()).toBe(indexNowKey);
  });

  it('les sondages GEO et les instantanés enregistrés sont valides', async () => {
    for (const [folder, schema] of [
      ['geo', geoSchema],
      ['historique', snapshotSchema],
    ] as const) {
      const dir = path.join(DATA_DIR, folder);
      if (!existsSync(dir)) continue;
      const files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
      for (const file of files) {
        const fullPath = path.join(DATA_DIR, folder, file);
        // Les instantanés d'un format plus ancien restent lisibles par un humain mais ne sont plus comparés.
        if (folder === 'historique' && (await snapshotVersion(fullPath)) !== SNAPSHOT_VERSION) {
          expect(Number(await snapshotVersion(fullPath)), file).toBeLessThan(SNAPSHOT_VERSION);
          continue;
        }
        await expect(readJson(fullPath, schema), file).resolves.toBeTruthy();
      }
    }
  });
});
