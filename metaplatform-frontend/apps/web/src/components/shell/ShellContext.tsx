import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * 应用壳的运行期状态：导航布局模式 / Copilot 开合 / ⌘K 开合。
 * 布局模式与 Copilot 偏好写 localStorage，刷新后保持（DESIGN-SPEC §3 布局模式切换）。
 */
export type NavMode = 'side' | 'top';

const NAV_MODE_KEY = 'mp_nav_mode';
const COPILOT_KEY = 'mp_copilot_open';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式 / 配额满：忽略，仅本次会话生效
  }
}

interface ShellContextValue {
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
  toggleNavMode: () => void;
  copilotOpen: boolean;
  openCopilot: () => void;
  toggleCopilot: () => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [navMode, setNavModeState] = useState<NavMode>(() =>
    readStored(NAV_MODE_KEY, ['side', 'top'] as const, 'side'),
  );
  const [copilotOpen, setCopilotOpen] = useState<boolean>(() =>
    readStored(COPILOT_KEY, ['open', 'closed'] as const, 'closed') === 'open',
  );
  const [commandOpen, setCommandOpen] = useState(false);

  const setNavMode = useCallback((mode: NavMode) => {
    setNavModeState(mode);
    writeStored(NAV_MODE_KEY, mode);
  }, []);

  const toggleNavMode = useCallback(() => {
    setNavModeState((prev) => {
      const next: NavMode = prev === 'side' ? 'top' : 'side';
      writeStored(NAV_MODE_KEY, next);
      return next;
    });
  }, []);

  const openCopilot = useCallback(() => {
    setCopilotOpen(true);
    writeStored(COPILOT_KEY, 'open');
  }, []);

  const toggleCopilot = useCallback(() => {
    setCopilotOpen((prev) => {
      writeStored(COPILOT_KEY, prev ? 'closed' : 'open');
      return !prev;
    });
  }, []);

  // ⌘K / Ctrl+K 全局绑定（DESIGN-SPEC §6.1）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const value = useMemo<ShellContextValue>(
    () => ({
      navMode,
      setNavMode,
      toggleNavMode,
      copilotOpen,
      openCopilot,
      toggleCopilot,
      commandOpen,
      setCommandOpen,
    }),
    [navMode, setNavMode, toggleNavMode, copilotOpen, openCopilot, toggleCopilot, commandOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
