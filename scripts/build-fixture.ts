// Construit une version de démonstration du site AVEC des épisodes, pour les tests de bout en bout :
// 1. copie les fiches de test (tests/fixtures/episodes) dans .e2e/episodes ;
// 2. lance la vraie synchronisation YouTube sur tests/fixtures/feed.xml (publie l'épisode annoncé) ;
// 3. construit le site dans dist-fixture/ à partir de ces épisodes.
// Les fiches de test sont indépendantes du vrai contenu (src/content/episodes reste intact).
import { cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const EPISODES = path.join(ROOT, '.e2e/episodes');
const OUT_DIR = 'dist-fixture';

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`Échec : ${command} ${args.join(' ')} (code ${result.status})`);
}

await rm(path.join(ROOT, '.e2e'), { recursive: true, force: true });
await cp(path.join(ROOT, 'tests/fixtures/episodes'), EPISODES, { recursive: true });
run(process.execPath, ['scripts/youtube-sync.ts', '--feed', 'tests/fixtures/feed.xml', '--episodes-dir', EPISODES]);
run('npx', ['astro', 'build', '--outDir', OUT_DIR], { TI_EPISODES_DIR: EPISODES });
console.log(`✓ Site de démonstration construit dans ${OUT_DIR}/`);
