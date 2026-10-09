import { beforeEach, expect, it, vi } from 'vitest';
import { editorIdentity, editorInputKey, readEditorInput, retainEditorInput, setEditorSessionIdentity } from './editorSession';

vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: null }) }));

beforeEach(() => setEditorSessionIdentity(''));

it.each([
  { id: '', tenantId: 'tenant' },
  { id: '   ', tenantId: 'tenant' },
  { id: 'known-person', tenantId: '' },
  { id: 'known-person', tenantId: '   ' },
])('rejects incomplete editor identity and clears the previous personal input: %j', (user) => {
  const known = editorIdentity({ id: 'known-person', tenantId: 'tenant' });
  const key = editorInputKey(known, 'create');
  readEditorInput(known, key);
  retainEditorInput(known, key, { name: 'previous personal input' });
  expect(readEditorInput(known, key)).toEqual({ name: 'previous personal input' });
  const unknown = editorIdentity(user);
  expect(unknown).toBe('');
  expect(readEditorInput(unknown, editorInputKey(unknown, 'create'))).toBeUndefined();
  expect(readEditorInput(known, key)).toBeUndefined();
});

it.each([['', ''], ['   ', '   ']])('does not share unsaved input between two same-tenant people without IDs (%j, %j)', (firstId, secondId) => {
  const first = editorIdentity({ id: firstId, tenantId: 'tenant' });
  const firstKey = editorInputKey(first, 'create');
  readEditorInput(first, firstKey);
  retainEditorInput(first, firstKey, { name: 'first unknown personal input' });
  const second = editorIdentity({ id: secondId, tenantId: 'tenant' });
  expect(readEditorInput(second, editorInputKey(second, 'create'))).toBeUndefined();
});

it('retains complete identities independently by actual user and tenant', () => {
  const first = editorIdentity({ id: 'known-person', tenantId: 'tenant' });
  const key = editorInputKey(first, 'edit', 'resource');
  readEditorInput(first, key);
  retainEditorInput(first, key, { name: 'personal input' });
  expect(readEditorInput(first, key)).toEqual({ name: 'personal input' });
  const other = editorIdentity({ id: 'second-person', tenantId: 'tenant' });
  expect(readEditorInput(other, editorInputKey(other, 'edit', 'resource'))).toBeUndefined();
  expect(readEditorInput(first, key)).toBeUndefined();
});
