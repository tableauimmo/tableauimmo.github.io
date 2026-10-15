// Interface des calculateurs (amélioration progressive) : sans JavaScript, la page affiche déjà
// l'exemple calculé au build ; avec JavaScript, le résultat suit chaque saisie, les erreurs sont
// signalées champ par champ et l'adresse devient un lien partageable (?montant=…&taux=…).
import { displayValue, runTool, type FieldError, type ToolDefinition } from './fields.ts';
import { parseFrenchNumber } from './numbers.ts';

const DEBOUNCE_MS = 180;

export function mountTool<K extends string, R>(tool: ToolDefinition<K, R>): void {
  const form = document.querySelector<HTMLFormElement>('form[data-tool]');
  const output = document.querySelector<HTMLElement>('[data-tool-result]');
  const summary = document.querySelector<HTMLElement>('[data-tool-summary]');
  if (!form || !output || !summary) return;

  const inputs = new Map<K, HTMLInputElement>();
  for (const field of tool.fields) {
    const input = form.elements.namedItem(field.name);
    if (input instanceof HTMLInputElement) inputs.set(field.name, input);
  }

  function fieldBox(name: string): HTMLElement | null {
    return form?.querySelector<HTMLElement>(`[data-field="${name}"]`) ?? null;
  }

  function showErrors(errors: FieldError[]): void {
    const byField = new Map(errors.map((error) => [error.field, error.message]));
    for (const field of tool.fields) {
      const box = fieldBox(field.name);
      const input = inputs.get(field.name);
      const slot = box?.querySelector<HTMLElement>('.field__error');
      const message = byField.get(field.name);
      if (!box || !input || !slot) continue;
      slot.textContent = message ?? '';
      if (message) {
        box.setAttribute('data-invalid', '');
        input.setAttribute('aria-invalid', 'true');
      } else {
        box.removeAttribute('data-invalid');
        input.removeAttribute('aria-invalid');
      }
    }
  }

  function readRaw(): Partial<Record<K, string>> {
    const raw: Partial<Record<K, string>> = {};
    for (const [name, input] of inputs) raw[name] = input.value;
    return raw;
  }

  function updateUrl(values: Record<K, number>): void {
    const params = new URLSearchParams();
    for (const field of tool.fields) {
      if (values[field.name] !== field.default) params.set(field.param, String(values[field.name]));
    }
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }

  function compute(options: { syncUrl: boolean }): void {
    const outcome = runTool(tool, readRaw());
    if (!outcome.ok) {
      showErrors(outcome.errors);
      form?.setAttribute('data-state', 'invalid');
      summary!.textContent = 'Le calcul attend des valeurs valides : corrigez les champs signalés.';
      return;
    }
    showErrors([]);
    form?.setAttribute('data-state', 'ok');
    const view = tool.view(outcome.result, outcome.values);
    output!.innerHTML = view.html;
    summary!.textContent = view.summary;
    if (options.syncUrl) updateUrl(outcome.values);
  }

  // Valeurs reçues dans l'adresse (lien partagé).
  const params = new URLSearchParams(location.search);
  let fromUrl = false;
  for (const field of tool.fields) {
    const value = params.get(field.param);
    const input = inputs.get(field.name);
    if (value === null || !input) continue;
    const parsed = parseFrenchNumber(value);
    input.value = parsed === null ? value : displayValue(field, parsed);
    fromUrl = true;
  }
  if (fromUrl) compute({ syncUrl: false });

  let timer: ReturnType<typeof setTimeout> | undefined;
  form.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => compute({ syncUrl: true }), DEBOUNCE_MS);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(timer);
    compute({ syncUrl: true });
    output.closest('section')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  form.addEventListener('reset', () => {
    // Laisse le navigateur remettre les valeurs par défaut, puis recalcule.
    setTimeout(() => compute({ syncUrl: true }), 0);
  });

  // Mise en forme à la sortie du champ : « 200000 » devient « 200 000 ».
  for (const field of tool.fields) {
    const input = inputs.get(field.name);
    input?.addEventListener('blur', () => {
      const parsed = parseFrenchNumber(input.value);
      if (parsed !== null && parsed >= field.min && parsed <= field.max) input.value = displayValue(field, parsed);
    });
  }

  form.setAttribute('data-enhanced', '');
}
