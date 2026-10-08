import { useEffect } from 'react';
import { useAuth } from '@mate/shared';
/** Unsaved UI input only: no backend facts, tokens, URLs or browser persistence. */
const retained = new Map<string, unknown>();
let activeIdentity = '';
export function editorIdentity(
  user: { id: string; tenantId: string } | null,
): string {
  return user ? JSON.stringify([user.id, user.tenantId]) : '';
}
export function setEditorSessionIdentity(identity: string): void {
  if (identity !== activeIdentity) {
    retained.clear();
    activeIdentity = identity;
  }
}
export function readEditorInput<T>(
  identity: string,
  key: string,
): T | undefined {
  setEditorSessionIdentity(identity);
  return identity ? (retained.get(key) as T | undefined) : undefined;
}
export function retainEditorInput<T>(
  identity: string,
  key: string,
  input: T,
): void {
  if (identity && identity === activeIdentity) retained.set(key, input);
}
export function discardEditorInput(key: string): void {
  retained.delete(key);
}
export function editorInputKey(
  identity: string,
  mode: 'create' | 'edit',
  rid?: string,
): string {
  return JSON.stringify([identity, mode, mode === 'edit' ? rid : 'create']);
}
/** Remains mounted when the editor is closed, so logout clears retained input immediately. */
export function EditorSessionIdentity() {
  const { user } = useAuth();
  const identity = editorIdentity(user);
  useEffect(() => {
    setEditorSessionIdentity(identity);
  }, [identity]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (retained.size) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return null;
}
