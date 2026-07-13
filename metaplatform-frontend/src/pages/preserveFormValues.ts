/**
 * AC-202.4 提交后保留已填值 — 纯函数工具集.
 *
 * 设计原则:
 *  1. 用户多次提交同一表单时, 保留已填的业务字段 (避免重复输入).
 *  2. 清空"敏感/唯一"字段: 提交人姓名 _name, 邮箱 _email, 备注 remark.
 *  3. 不修改原对象, 返回新对象 (React state immutability).
 *  4. localStorage 持久化: 刷新页面后仍能保留.
 */

/** 提交后应清空的字段集合 (每提交一次就需要重新填的字段). */
export const PRESERVE_BLACKLIST_FIELDS = new Set<string>([
  "_name",        // 提交人姓名
  "_email",       // 提交人邮箱
  "_signature",   // 签名 (有法律效力)
  "_captcha",     // 验证码
]);

/**
 * 给定上一次提交成功的值, 计算"再提交一份"的初始值.
 *  - 黑名单字段清空
 *  - 其余字段保留原值
 *  - 字段若 schema 中已删除, 也一并剔除 (避免脏数据)
 */
export function computeResubmitValues(
  lastValues: Record<string, string>,
  activeFieldKeys: string[],
): Record<string, string> {
  const activeSet = new Set(activeFieldKeys);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(lastValues)) {
    // 黑名单字段清空
    if (PRESERVE_BLACKLIST_FIELDS.has(key)) continue;
    // schema 中已删除的字段剔除
    if (!activeSet.has(key)) continue;
    result[key] = value;
  }
  // 确保所有 active 字段都有初始值 (避免 undefined)
  for (const key of activeFieldKeys) {
    if (!(key in result)) result[key] = "";
  }
  return result;
}

/**
 * 完整重置表单值 (用于"完全重新填写"按钮).
 *  - 所有字段清空
 */
export function computeResetValues(activeFieldKeys: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of activeFieldKeys) result[key] = "";
  return result;
}

/**
 * localStorage 序列化 / 反序列化.
 * - 用 formId 命名空间隔离不同表单的草稿.
 * - 顶层带 timestamp, 用于过期清理.
 */
const DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;  // 24 小时

export interface PreservedDraft {
  version: number;
  formId: string;
  values: Record<string, string>;
  savedAt: number;
}

export function saveDraft(formId: string, values: Record<string, string>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const draft: PreservedDraft = {
      version: DRAFT_VERSION,
      formId,
      values,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(`form-draft:${formId}`, JSON.stringify(draft));
  } catch {
    // quota exceeded / disabled — silently fail
  }
}

export function loadDraft(formId: string): Record<string, string> | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(`form-draft:${formId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreservedDraft;
    // 兼容性检查 + 过期清理
    if (parsed.version !== DRAFT_VERSION) return null;
    if (parsed.formId !== formId) return null;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(`form-draft:${formId}`);
      return null;
    }
    return parsed.values;
  } catch {
    return null;
  }
}

export function clearDraft(formId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(`form-draft:${formId}`);
  } catch {
    /* noop */
  }
}