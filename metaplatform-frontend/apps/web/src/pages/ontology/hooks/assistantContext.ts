/**
 * 本体域上下文（ADR-0065 / `MP-CONTEXT-AWARE-01` S2）——前端侧的**分层状态键**。
 *
 * <p>服务端契约见 `mate_app_copilot/context_envelope.py`（S1，已交付）：它接一个自由
 * 字典，把 `navigation` / `selection` / `pendingSelection` 三层消毒后折进 system prompt，
 * 并保留 `interaction` / `subject` 两个 v0 兼容键。
 *
 * <p>本模块只做**收集与组装**，不做渲染、不落库（v1 请求作用域，ADR §2.1-3）。
 *
 * <h3>为什么是一个模块级 store，而不是 React Context</h3>
 * 写入方（`OntologyDomainShell` 的路由态、`ObjectExplorerPage` 的选中态）与读取方
 * （全局 `CopilotDock`、未来的 `useOntologyAssistant` 宿主）**不在同一棵 React 树**：
 * CopilotDock 挂在 `AppShell`，是域级壳的祖先的兄弟，Context 传不过去。所以这里用
 * 一个最小的外部 store（`useSyncExternalStore` 订阅），跨树共享。
 *
 * <h3>只存标识，不存快照</h3>
 * `selection.items` 只有 `{rid, label}`，`navigation` 只有视图名与 RID——源记录由 agent
 * 用本体工具按 RID **水合**（ADR §2 硬约定 ①）。把对象快照塞进来就等于让模型基于陈旧
 * 数据行动，且会把 prompt 撑爆（服务端 4KB 上限）。
 */

export interface AssistantNavigationState {
  /** 语义视图名（宿主命名空间，如 `ontology-objects`）。 */
  view: string;
  /** 活跃 tab（可选）。 */
  tab?: string;
  /** 打开中的记录 RID（可选）。 */
  openRecordIds?: string[];
  /** 原始 URL——可分享过滤器的**唯一事实源**（ADR §1.1 硬约定 ④）。 */
  url: string;
}

export interface AssistantSelectionItem {
  rid: string;
  label: string;
}

export interface AssistantSelection {
  /** 选中物类型，"宿主命名空间.物类"。 */
  kind: string;
  items: AssistantSelectionItem[];
  /** 抓取时刻（**毫秒**）——服务端按它判定陈旧（R2），单位错了整条线索就废了。 */
  capturedAt: number;
}

/** 一次性划词上下文（消费即弃）。 */
export interface AssistantPendingSelection {
  text: string;
  sourceRid?: string;
}

export interface AssistantInteractionContext {
  appCode: string;
  pageCode: string;
  pageUrl: string;
}

/** 服务端 S1 的单个自由文本上限（`FREE_TEXT_MAX_CHARS`）；这里同步裁剪，省一次浪费。 */
const FREE_TEXT_MAX_CHARS = 200;
const MAX_SELECTION_ITEMS = 20;

function cleanText(value: unknown, limit = FREE_TEXT_MAX_CHARS): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\s\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, limit);
}

/**
 * 组装 stream body 的 `context` 对象。
 *
 * <p>**只有真的有内容时才带上分层键**：只发 `interaction` 的旧宿主，其 payload 与
 * 改造前**逐字节相同**（`{interaction: {...}}`）——这是服务端 R3 兼容快照等价的
 * 前端一侧保证。空数组 / 空串一律不落键，免得渲染出一个"有键但没信息"的分层段。
 */
export function buildAssistantContextEnvelope(input: {
  interaction: AssistantInteractionContext;
  navigation?: AssistantNavigationState | null;
  selection?: AssistantSelection | null;
  pendingSelection?: AssistantPendingSelection | null;
}): Record<string, unknown> {
  const interaction: Record<string, string> = {};
  const appCode = cleanText(input.interaction?.appCode);
  const pageCode = cleanText(input.interaction?.pageCode);
  const pageUrl = cleanText(input.interaction?.pageUrl, 512);
  if (appCode) interaction.appCode = appCode;
  if (pageCode) interaction.pageCode = pageCode;
  if (pageUrl) interaction.pageUrl = pageUrl;

  const envelope: Record<string, unknown> = { interaction };

  const nav = input.navigation;
  if (nav) {
    const view = cleanText(nav.view);
    const url = cleanText(nav.url, 512);
    const tab = cleanText(nav.tab);
    const openRecordIds = (nav.openRecordIds ?? [])
      .map((rid) => cleanText(rid))
      .filter((rid) => rid.length > 0)
      .slice(0, MAX_SELECTION_ITEMS);
    const navigation: Record<string, unknown> = {};
    if (view) navigation.view = view;
    if (tab) navigation.tab = tab;
    if (url) navigation.url = url;
    if (openRecordIds.length > 0) navigation.openRecordIds = openRecordIds;
    if (Object.keys(navigation).length > 0) envelope.navigation = navigation;
  }

  const sel = input.selection;
  if (sel) {
    const kind = cleanText(sel.kind);
    const items = (sel.items ?? [])
      .map((item) => ({ rid: cleanText(item?.rid), label: cleanText(item?.label) }))
      .filter((item) => item.rid.length > 0)
      .slice(0, MAX_SELECTION_ITEMS);
    if (items.length > 0) {
      const selection: Record<string, unknown> = { kind: kind || 'selection', items };
      if (Number.isFinite(sel.capturedAt)) selection.capturedAt = Math.round(sel.capturedAt);
      envelope.selection = selection;
    }
  }

  const pending = input.pendingSelection;
  if (pending) {
    const text = cleanText(pending.text);
    if (text) {
      const pendingSelection: Record<string, string> = { text };
      const sourceRid = cleanText(pending.sourceRid);
      if (sourceRid) pendingSelection.sourceRid = sourceRid;
      envelope.pendingSelection = pendingSelection;
    }
  }

  return envelope;
}

// ── 模块级 store：本体域路由态 + 选中态 ───────────────────────────────────────

export interface OntologyContextSnapshot {
  /** 路由态（`OntologyDomainShell` 写入）。 */
  navigation: AssistantNavigationState | null;
  /** 列表选中态（`ObjectExplorerPage` 写入）。 */
  selection: AssistantSelection | null;
}

const EMPTY_SNAPSHOT: OntologyContextSnapshot = { navigation: null, selection: null };

let snapshot: OntologyContextSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(next: OntologyContextSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** 按值比较：写入方每次渲染都会新建对象，按引用比会**每帧都通知订阅者**。 */
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function setOntologyNavigation(navigation: AssistantNavigationState | null): void {
  if (sameJson(navigation, snapshot.navigation)) return;
  emit({ ...snapshot, navigation });
}

export function setOntologySelection(selection: AssistantSelection | null): void {
  if (sameJson(selection, snapshot.selection)) return;
  emit({ ...snapshot, selection });
}

export function getOntologyContextSnapshot(): OntologyContextSnapshot {
  return snapshot;
}

/** `useSyncExternalStore` 的服务端快照：恒定引用，避免 SSR 下无限重渲染。 */
export function getOntologyContextServerSnapshot(): OntologyContextSnapshot {
  return EMPTY_SNAPSHOT;
}

export function subscribeOntologyContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
