import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Workflow = { on?: unknown; permissions?: Record<string, string>; jobs?: Record<string, { steps?: { uses?: string; run?: string }[]; uses?: string; permissions?: Record<string, string> }> };

// Un workflow GitHub invalide ne s'exécute pas du tout : on le valide avant tout envoi.
describe('workflows GitHub Actions', async () => {
  const files = (await readdir('.github/workflows')).filter((file) => /\.ya?ml$/.test(file));
  const load = async (file: string) => parse(await readFile(`.github/workflows/${file}`, 'utf8'), { strict: true }) as Workflow;

  it('existent', () => {
    expect(files.sort()).toEqual(['deploy.yml', 'youtube-sync.yml']);
  });

  it.each(files)('%s est un YAML valide avec des jobs', async (file) => {
    const workflow = await load(file);
    expect(workflow.on).toBeDefined();
    expect(Object.keys(workflow.jobs ?? {}).length).toBeGreaterThan(0);
    for (const job of Object.values(workflow.jobs ?? {})) expect(Array.isArray(job.steps) || typeof job.uses === 'string').toBe(true);
  });

  it('le déploiement publie dist/ sur GitHub Pages', async () => {
    const text = await readFile('.github/workflows/deploy.yml', 'utf8');
    expect(text).toContain('actions/upload-pages-artifact');
    expect(text).toContain('actions/deploy-pages');
    expect(text).toContain('workflow_call');
    expect(text).toMatch(/path: dist/);
  });

  it('la synchro YouTube tourne toutes les heures et signe ses commits « Tableau Immo »', async () => {
    const text = await readFile('.github/workflows/youtube-sync.yml', 'utf8');
    expect(text).toMatch(/cron: '\d+ \* \* \* \*'/);
    expect(text).toContain('git config user.name "Tableau Immo"');
    expect(text).toContain('git config user.email "tableauimmo@gmail.com"');
    expect(text).toContain('uses: ./.github/workflows/deploy.yml');
  });
});
