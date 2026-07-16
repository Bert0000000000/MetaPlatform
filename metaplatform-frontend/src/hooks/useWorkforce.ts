/**
 * useWorkforce — 管理"应用数字员工"的人类化设置
 * --------------------------------------------------------------------------
 * 每个应用 (appId) 都拥有一位数字员工, 此 hook 提供其名字 / 头像的 localStorage
 * 持久化与读写. 配套的 WorkforceCenter 页可集中管理.
 *
 * 持久化 key:
 *   metaplatform:workforce:<appId>:name      默认 "数字员工"
 *   metaplatform:workforce:<appId>:avatar    默认 "violet"
 *   metaplatform:workforce:<appId>:role      默认 "应用助手"
 *
 * 头像预设 (按 Tailwind gradient 颜色):
 *   violet | fuchsia | blue | emerald | amber | rose
 */

import { useCallback, useEffect, useState } from "react";

export type WorkforceAvatarKey = "violet" | "fuchsia" | "blue" | "emerald" | "amber" | "rose";

/**
 * 应用型数字员工. 每个 appId 都有自己的"人设" (名字 / 头像 / 角色), 数据
 * 持久化在 localStorage. 默认名字 "应小帅" (可改名). 不同应用的默认头像
 * 按 appId 哈希分配, 视觉上能区分.
 */
export const DEFAULT_WORKFORCE_NAMES = [
  "应小帅", "应小慧", "应小美", "应小强", "应小灵", "应小樱",
] as const;

const DEFAULT_NAME = "应小帅";

/** 给定 appId 取一个稳定的名字 (默认名为 "应小帅") */
export function defaultNameFor(appId: string): string {
  if (!appId) return DEFAULT_NAME;
  let h = 0;
  for (let i = 0; i < appId.length; i++) h = (h * 31 + appId.charCodeAt(i)) | 0;
  return DEFAULT_WORKFORCE_NAMES[Math.abs(h) % DEFAULT_WORKFORCE_NAMES.length];
}

/** 给定 appId 取一个稳定的头像 */
export function defaultAvatarFor(appId: string): WorkforceAvatarKey {
  if (!appId) return "violet";
  let h = 0;
  for (let i = 0; i < appId.length; i++) h = (h * 17 + appId.charCodeAt(i)) | 0;
  const list: WorkforceAvatarKey[] = ["violet", "fuchsia", "blue", "emerald", "amber", "rose"];
  return list[Math.abs(h) % list.length];
}

export interface WorkforceAvatar {
  key: WorkforceAvatarKey;
  /** 主色 Tailwind 渐变 (bg-gradient-to-br) */
  gradient: string;
  /** 占位字符 (取名字的第一个字) */
  preview: (name: string) => string;
}

export const WORKFORCE_AVATARS: Record<WorkforceAvatarKey, WorkforceAvatar> = {
  violet:  { key: "violet",  gradient: "from-violet-500 to-fuchsia-500", preview: n => (n || "数").slice(0, 1) },
  fuchsia: { key: "fuchsia", gradient: "from-fuchsia-500 to-pink-500",   preview: n => (n || "数").slice(0, 1) },
  blue:    { key: "blue",    gradient: "from-blue-500 to-cyan-500",      preview: n => (n || "数").slice(0, 1) },
  emerald: { key: "emerald", gradient: "from-emerald-500 to-teal-500",   preview: n => (n || "数").slice(0, 1) },
  amber:   { key: "amber",   gradient: "from-amber-500 to-orange-500",   preview: n => (n || "数").slice(0, 1) },
  rose:    { key: "rose",    gradient: "from-rose-500 to-pink-500",      preview: n => (n || "数").slice(0, 1) },
};

const NAME_KEY = (appId: string) => `metaplatform:workforce:${appId}:name`;
const AVATAR_KEY = (appId: string) => `metaplatform:workforce:${appId}:avatar`;
const ROLE_KEY = (appId: string) => `metaplatform:workforce:${appId}:role`;

/** 读取安全 (localStorage 可能抛错 / SSR) */
function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * 给定一个 appId, 返回该应用的数字员工设置 (名字 / 头像 / 角色).
 * 通过 storage 事件实现多 tab 同步 (同一浏览器改一处, 其它 tab 自动更新).
 *
 * 每个 app 首次打开会默认生成一个数字员工: 名字 "应小帅" (按 appId 哈希
 * 派生出 应小帅/慧/美/强/灵/樱 之一), 头像也是按 appId 哈希稳定分配.
 */
export function useWorkforce(appId: string | null | undefined) {
  const [name, setNameState] = useState<string>(DEFAULT_NAME);
  const [avatar, setAvatarState] = useState<WorkforceAvatarKey>("violet");
  const [role, setRoleState] = useState<string>("应用助手");

  // 初始化与 appId 变化时读取
  useEffect(() => {
    if (!appId) return;
    const n = safeGet(NAME_KEY(appId));
    const a = safeGet(AVATAR_KEY(appId));
    const r = safeGet(ROLE_KEY(appId));
    if (n) setNameState(n);
    else setNameState(defaultNameFor(appId));
    if (a && (Object.keys(WORKFORCE_AVATARS) as WorkforceAvatarKey[]).includes(a as WorkforceAvatarKey)) {
      setAvatarState(a as WorkforceAvatarKey);
    } else {
      setAvatarState(defaultAvatarFor(appId));
    }
    if (r) setRoleState(r);
    else setRoleState("应用助手");
  }, [appId]);

  // 跨 tab 同步
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!appId || !e.key) return;
      if (e.key === NAME_KEY(appId) && typeof e.newValue === "string") setNameState(e.newValue);
      else if (e.key === AVATAR_KEY(appId) && typeof e.newValue === "string") {
        if ((Object.keys(WORKFORCE_AVATARS) as WorkforceAvatarKey[]).includes(e.newValue as WorkforceAvatarKey)) {
          setAvatarState(e.newValue as WorkforceAvatarKey);
        }
      } else if (e.key === ROLE_KEY(appId) && typeof e.newValue === "string") {
        setRoleState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [appId]);

  const setName = useCallback((newName: string) => {
    if (!appId) return;
    const trimmed = (newName || "").trim().slice(0, 16) || DEFAULT_NAME;
    setNameState(trimmed);
    safeSet(NAME_KEY(appId), trimmed);
  }, [appId]);

  const setAvatar = useCallback((key: WorkforceAvatarKey) => {
    if (!appId) return;
    setAvatarState(key);
    safeSet(AVATAR_KEY(appId), key);
  }, [appId]);

  const setRole = useCallback((r: string) => {
    if (!appId) return;
    const trimmed = (r || "").trim().slice(0, 32) || "应用助手";
    setRoleState(trimmed);
    safeSet(ROLE_KEY(appId), trimmed);
  }, [appId]);

  const avatarMeta: WorkforceAvatar = WORKFORCE_AVATARS[avatar] ?? WORKFORCE_AVATARS.violet;

  return {
    name,
    avatar,
    avatarMeta,
    role,
    setName,
    setAvatar,
    setRole,
  };
}

/** 不订阅 hook 的纯读取 (用于一次性展示, 例如 CardTitle) */
export function readWorkforceName(appId: string): string {
  return safeGet(NAME_KEY(appId)) || defaultNameFor(appId);
}
