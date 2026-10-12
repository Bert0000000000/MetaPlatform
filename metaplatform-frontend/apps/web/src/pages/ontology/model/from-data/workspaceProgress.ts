import type { ModelingSource } from '@/api/ont/modeling';
import { getUser } from '@/utils/auth';

type Edits = Pick<ModelingSource, 'draft' | 'context' | 'questions' | 'resolutions'>;
interface Progress { sourceId: string; step: number; revision: number; generating: boolean; edits?: Edits }
const key = () => {
  const user = getUser();
  return `ontology-discovery-progress:${user?.tenantId ?? 'anonymous'}:${user?.id ?? 'anonymous'}`;
};

export function readProgress(): Progress | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key()) || 'null') as Progress | null;
    if (!value || typeof value.sourceId !== 'string' || !Number.isInteger(value.step) || value.step < 0 || value.step > 4 || !Number.isInteger(value.revision)) return null;
    if (value.edits && (typeof value.edits.context !== 'string' || !Array.isArray(value.edits.questions) || !value.edits.resolutions || !('draft' in value.edits))) return null;
    return value;
  } catch { return null; }
}

export function rememberProgress(source: ModelingSource, step: number, dirty: boolean) {
  try {
    const value: Progress = { sourceId: source.id, step, revision: source.revision, generating: source.job?.kind === 'generate' && source.job.status === 'running' };
    if (dirty) value.edits = { draft: source.draft, context: source.context, questions: source.questions, resolutions: source.resolutions };
    sessionStorage.setItem(key(), JSON.stringify(value));
  } catch { /* Storage can be unavailable or full; server saves remain available. */ }
}

export function clearProgress() {
  try { sessionStorage.removeItem(key()); } catch { /* Optional session storage. */ }
}
