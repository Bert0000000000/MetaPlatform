import { get, post, put, del } from './client';

export interface OntologyVersion {
  versionId: string;
  code: string;
  description?: string;
  snapshot: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  createdBy?: string;
  createdAt: string;
}

const STORAGE_KEY = 'ontstudio_versions';

function load(): OntologyVersion[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OntologyVersion[];
  } catch {
    return [];
  }
}

function save(items: OntologyVersion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listVersions(): Promise<OntologyVersion[]> {
  try {
    return await get<OntologyVersion[]>('/v1/ont/versions');
  } catch {
    return load().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function createVersion(req: Omit<OntologyVersion, 'versionId' | 'createdAt'>): Promise<OntologyVersion> {
  try {
    return await post<OntologyVersion>('/v1/ont/versions', req);
  } catch {
    const items = load();
    const created: OntologyVersion = {
      versionId: generateId(),
      ...req,
      createdAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateVersion(id: string, req: Partial<OntologyVersion>): Promise<OntologyVersion> {
  try {
    return await put<OntologyVersion>(`/v1/ont/versions/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((v) => v.versionId === id);
    if (idx === -1) throw new Error('版本不存在');
    items[idx] = { ...items[idx]!, ...req };
    save(items);
    return items[idx]!;
  }
}

export async function deleteVersion(id: string): Promise<void> {
  try {
    await del(`/v1/ont/versions/${id}`);
  } catch {
    save(load().filter((v) => v.versionId !== id));
  }
}

export async function compareVersions(
  aId: string,
  bId: string,
): Promise<{ added: string[]; removed: string[]; modified: string[] }> {
  const [a, b] = await Promise.all([
    listVersions().then((arr) => arr.find((v) => v.versionId === aId)!),
    listVersions().then((arr) => arr.find((v) => v.versionId === bId)!),
  ]);
  try {
    const aObj = JSON.parse(a.snapshot) as Record<string, unknown>;
    const bObj = JSON.parse(b.snapshot) as Record<string, unknown>;
    const aKeys = new Set(Object.keys(aObj));
    const bKeys = new Set(Object.keys(bObj));
    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    bKeys.forEach((k) => {
      if (!aKeys.has(k)) added.push(k);
      else if (JSON.stringify(aObj[k]) !== JSON.stringify(bObj[k])) modified.push(k);
    });
    aKeys.forEach((k) => {
      if (!bKeys.has(k)) removed.push(k);
    });
    return { added, removed, modified };
  } catch {
    return { added: [], removed: [], modified: [] };
  }
}
