import { useEffect, useState, useCallback } from 'react';

export interface OpenAppTab {
  /** App id (slug) */
  id: string;
  /** App name */
  name: string;
  /** Icon node (rendered as ReactNode) */
  iconKey?: string;
}

const STORAGE_KEY = 'mate.openAppTabs';
const ACTIVE_KEY = 'mate.activeAppId';

function readOpen(): OpenAppTab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OpenAppTab[]) : [];
  } catch {
    return [];
  }
}

function writeOpen(items: OpenAppTab[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function readActive(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

function writeActive(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id === null) localStorage.removeItem(ACTIVE_KEY);
  else localStorage.setItem(ACTIVE_KEY, id);
}

// Simple pub-sub for cross-component sync
type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

/** Open (or focus) an app tab. Idempotent: if already open, activates it. */
export function openAppTab(app: OpenAppTab) {
  const items = readOpen();
  const existing = items.find((t) => t.id === app.id);
  if (!existing) {
    items.push(app);
    writeOpen(items);
  }
  writeActive(app.id);
  notify();
}

/** Close an app tab. If closing the active one, navigates user away. */
export function closeAppTab(id: string, onCloseActive?: (nextId: string | null) => void) {
  const items = readOpen().filter((t) => t.id !== id);
  writeOpen(items);
  const active = readActive();
  if (active === id) {
    const next = items[items.length - 1]?.id ?? null;
    writeActive(next);
    onCloseActive?.(next);
  }
  notify();
}

export function getOpenAppTabs(): OpenAppTab[] {
  return readOpen();
}

export function getActiveAppId(): string | null {
  return readActive();
}

/**
 * React hook: subscribe to the open app tabs + active id, re-render on change.
 */
export function useAppTabs(): {
  tabs: OpenAppTab[];
  activeId: string | null;
  openTab: (app: OpenAppTab) => void;
  closeTab: (id: string, onCloseActive?: (nextId: string | null) => void) => void;
} {
  const [tabs, setTabs] = useState<OpenAppTab[]>(() => readOpen());
  const [activeId, setActiveId] = useState<string | null>(() => readActive());

  useEffect(() => {
    const listener: Listener = () => {
      setTabs(readOpen());
      setActiveId(readActive());
    };
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === ACTIVE_KEY) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const openTab = useCallback((app: OpenAppTab) => openAppTab(app), []);
  const closeTab = useCallback(
    (id: string, onCloseActive?: (nextId: string | null) => void) =>
      closeAppTab(id, onCloseActive),
    [],
  );

  return { tabs, activeId, openTab, closeTab };
}