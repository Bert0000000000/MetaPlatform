import { useState, useEffect, useCallback, useRef } from "react";
import { appsApi, filesystemApi, appPageComponentsApi, appServiceApi, appReportsApi, appDashboardsApi } from "@/lib/api";
import type { AppPageComponent } from "@/lib/api";
import type { PageComponent, PageVersion } from "./types";
import { getMockComponents } from "./mockData";

/**
 * P3-2: 把已发布的 form schema 投到一个 PageComponent, FormLowCodeEditor 即时识别.
 * 该函数幂等: 没有 fields/sections 时返回空数组, caller fallback 到 mock.
 */
function extractDesignerState(pageDef: any): any {
  if (!pageDef) return null;
  if (pageDef.designerState) return pageDef.designerState;
  const sentinel = pageDef.components?.find((c: any) => c.type === "__designer_state__");
  if (sentinel?.props?.state) return sentinel.props.state;
  return null;
}

function sanitizeFormCode(raw: string): string {
  let code = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_{2,}/g, "_");
  if (!/^[a-z]/.test(code)) code = "f" + code;
  if (code.length > 64) code = code.slice(0, 64);
  return code;
}

function schemaToComponents(schema: any, fallbackName?: string): PageComponent[] {
  if (!schema || typeof schema !== "object") return [];
  const fields = Array.isArray(schema.fields) ? schema.fields
    : (Array.isArray(schema.sections) ? schema.sections.flatMap((s: any) => s.fields || []) : []);
  // 即使 fields 为空也 fallback (返回空数组). 仅 designer state 语义可用;
  // 优先用 DesignerState 协议以让 FormLowCodeEditor 立即识别 props.state.
  return [
    {
      id: "__designer_state__",
      type: "__designer_state__",
      span: 12,
      props: {
        state: {
          version: 1,
          pageName: fallbackName || "表单",
          pageType: "form",
          sections: Array.isArray(schema.sections)
            ? schema.sections
            : (fields.length > 0 ? [{ id: `s_${Date.now()}`, title: "默认分组", fields }] : []),
          boundObjectId: schema.boundObjectId || null,
          ...(fallbackName ? { } : {}),
        },
      },
    } as unknown as PageComponent,
  ];
}

/**
 * 当 page.type 属于 form / report / dashboard 之一, 把 pageDef (含 components / version / versionHistory)
 * 同时持久化到对应的"业务表":
 *  - form       → app_forms.schema_json
 *  - report     → app_reports.layout_json + widgets_json (从 components 摊平)
 *  - dashboard  → app_dashboards.layout_json + widgets_json (从 components 摊平)
 *
 * 该函数 idempotent:
 *  - 若 page.form_id / report_id / dashboard_id 已存在 → update;
 *  - 否则 create 并立即把新 id 回写到 app_pages.form_id / report_id / dashboard_id 字段.
 */
async function mirrorToBusinessTable(
  appId: string,
  pageId: string,
  pageType: string,
  pageName: string,
  pageDef: any,
  linkedIds: { form_id: string | null; report_id: string | null; dashboard_id: string | null },
  setLinkedIds: (next: { form_id: string | null; report_id: string | null; dashboard_id: string | null }) => void,
): Promise<void> {
  try {
    if (pageType === "form") {
      // schema_json = DesignerState 协议化的结构 — 完整 pageDef 也可作为 fallback
      const designerState = extractDesignerState(pageDef);
      const schemaToStore = designerState ?? pageDef;
      const objectId = designerState?.boundObjectId ? Number(designerState.boundObjectId) : undefined;
      const code = sanitizeFormCode(`form_page_${pageId}`);
      let fid = linkedIds.form_id;
      if (!fid) {
        if (!objectId) {
          console.warn("[mirrorToBusinessTable] form page has no boundObjectId; skip creating app_form");
        } else {
          try {
            const r = await appServiceApi.forms.create(appId, {
              objectId,
              code,
              name: pageName,
              schema: schemaToStore,
            });
            fid = String(r.id);
            // 回写到 app_pages
            try {
              await appsApi.updatePage(appId, pageId, { form_id: fid } as any);
            } catch (we) { console.warn("[mirrorToBusinessTable] updatePage(form_id) failed:", we); }
            setLinkedIds({ ...linkedIds, form_id: fid });
          } catch (ce) { console.warn("[mirrorToBusinessTable] appServiceApi.forms.create failed:", ce); }
        }
      } else {
        try {
          await appServiceApi.forms.update(appId, fid, {
            name: pageName,
            schema: schemaToStore,
          });
        } catch (ue) { console.warn("[mirrorToBusinessTable] appServiceApi.forms.update failed:", ue); }
      }
    } else if (pageType === "report") {
      // 报表: layout_json + widgets_json (从 components 拆出 widget 列表)
      const layout = pageDef;
      const widgets = Array.isArray(pageDef?.components) ? pageDef.components : [];
      let rid = linkedIds.report_id;
      if (!rid) {
        const r = await appReportsApi.create(appId, {
          name: pageName,
          layout,
          widgets,
        });
        rid = r.id;
        try { await appsApi.updatePage(appId, pageId, { report_id: rid } as any); } catch (we) { console.warn(we); }
        setLinkedIds({ ...linkedIds, report_id: rid });
      } else {
        try {
          await appReportsApi.update(appId, rid, { name: pageName, layout, widgets });
        } catch (ue) { console.warn("[mirrorToBusinessTable] appReportsApi.update failed:", ue); }
      }
    } else if (pageType === "dashboard") {
      const layout = pageDef;
      const widgets = Array.isArray(pageDef?.components) ? pageDef.components : [];
      let did = linkedIds.dashboard_id;
      if (!did) {
        const r = await appDashboardsApi.create(appId, {
          name: pageName,
          layout,
          widgets,
        });
        did = r.id;
        try { await appsApi.updatePage(appId, pageId, { dashboard_id: did } as any); } catch (we) { console.warn(we); }
        setLinkedIds({ ...linkedIds, dashboard_id: did });
      } else {
        try {
          await appDashboardsApi.update(appId, did, { name: pageName, layout, widgets });
        } catch (ue) { console.warn("[mirrorToBusinessTable] appDashboardsApi.update failed:", ue); }
      }
    }
  } catch (e) {
    console.error("[mirrorToBusinessTable] failed:", e);
  }
}

/**
 * Persist in-place page components into the dedicated `app_page_components` table.
 *
 * Strategy:
 *  - List existing rows for the page in the DB.
 *  - For each in-memory component:
 *      - if its id starts with "real_" (i.e. already stored in DB) → update.
 *      - else → create, then remember the new server id back into local state
 *        (so subsequent saves will treat it as "real_").
 *  - For each DB row that is no longer present in-memory → remove.
 *
 * Best-effort: errors from individual calls are logged but do not throw so the
 * outer save flow (filesystem + appsApi.updatePage) can still succeed. The
 * `app_pages.config` JSON column remains the fallback / forward-compat store.
 */
async function saveComponentsToDb(
  appId: string,
  pageId: string,
  components: PageComponent[],
): Promise<{ idMap: Map<string, string> }> {
  const idMap = new Map<string, string>();
  try {
    const existing = await appPageComponentsApi.list(appId, pageId);
    const dbRows: AppPageComponent[] = Array.isArray(existing) ? existing : [];
    const inMemoryIds = new Set<string>();

    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      if (!c || !c.id) continue;
      const isReal = /^real_/.test(c.id);
      inMemoryIds.add(c.id);
      try {
        if (isReal) {
          await appPageComponentsApi.update(appId, c.id, {
            pageId,
            componentKey: c.type,
            props: c.props ?? {},
            x: 0,
            y: i,
            w: 1,
            h: 1,
            sortOrder: i,
          });
        } else {
          const created = await appPageComponentsApi.create(appId, {
            pageId,
            componentKey: c.type,
            props: c.props ?? {},
            x: 0,
            y: i,
            w: 1,
            h: 1,
            sortOrder: i,
          });
          if (created?.id) {
            idMap.set(c.id, created.id);
          }
        }
      } catch (innerErr) {
        console.error("[saveComponentsToDb] failed to persist component", c.id, innerErr);
      }
    }

    // Remove DB rows that no longer exist in-memory
    for (const row of dbRows) {
      if (!inMemoryIds.has(row.id)) {
        try {
          await appPageComponentsApi.remove(appId, row.id);
        } catch (rmErr) {
          console.error("[saveComponentsToDb] failed to remove", row.id, rmErr);
        }
      }
    }
  } catch (e) {
    console.error("[saveComponentsToDb] failed to list/persist components:", e);
  }
  return { idMap };
}

export interface UsePageEditorReturn {
  pageData: any;
  pageName: string;
  setPageName: (name: string) => void;
  components: PageComponent[];
  setComponents: React.Dispatch<React.SetStateAction<PageComponent[]>>;
  currentVersion: number;
  versions: PageVersion[];
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  saving: boolean;
  device: "desktop" | "tablet" | "mobile";
  setDevice: (d: "desktop" | "tablet" | "mobile") => void;
  showAI: boolean;
  setShowAI: (show: boolean) => void;
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
  loading: boolean;
  loadPage: () => Promise<void>;
  savePage: () => Promise<void>;
  restoreVersion: (ver: PageVersion) => void;
  markDirty: () => void;
}

export function usePageEditor(appId: string | undefined, pageId: string | null): UsePageEditorReturn {
  const [pageData, setPageData] = useState<any>(null);
  const [pageName, setPageName] = useState("");
  const [components, setComponents] = useState<PageComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showAI, setShowAI] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  /** 关联到后端业务表 (form/report/dashboard) 的 id, 用于 savePage 知道要写哪一行 */
  const [linkedIds, setLinkedIds] = useState<{
    form_id: string | null;
    report_id: string | null;
    dashboard_id: string | null;
  }>({ form_id: null, report_id: null, dashboard_id: null });

  // 记录上一次加载的 pageId, 仅在 pageId 真正变化时才重置 pageName / components,
  // 避免同名 pageId 重新加载时把用户未保存的编辑覆盖掉。
  const lastLoadedPageIdRef = useRef<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!appId || !pageId) { setLoading(false); return; }
    try {
      const isPageSwitch = lastLoadedPageIdRef.current !== pageId;
      const pages = await appsApi.listPages(appId);
      const page = pages?.find((p: any) => p.id === pageId);
      if (page) {
        setPageData(page);
        // 切换页面时才用后端 name 覆盖, 保持当前编辑中(或刚刚改名未保存)的值
        if (isPageSwitch) setPageName(page.name);
        // 同步 page.form_id / page.report_id / page.dashboard_id 到 hook state (供 savePage 路由)
        setLinkedIds({
          form_id: page.form_id || null,
          report_id: page.report_id || null,
          dashboard_id: page.dashboard_id || null,
        });
      }
      const files = await filesystemApi.listFiles({ app_id: appId });
      const configFile = files?.find((f: any) => f.name === `page-${pageId}.json`);
      if (configFile?.content) {
        const parsed = JSON.parse(configFile.content);
        if (isPageSwitch) {
          if (parsed.components) setComponents(parsed.components);
          if (parsed.version) setCurrentVersion(parsed.version);
          if (parsed.versionHistory) setVersions(parsed.versionHistory);
        }
      } else if (page && isPageSwitch) {
        // No saved content — try link to backend form / report / dashboard; fallback to mock data.
        if (page.type === "form" && page.form_id) {
          try {
            const formDef = await appServiceApi.forms.get(appId, page.form_id);
            const schema = formDef.schemaJson ? JSON.parse(formDef.schemaJson) : {};
            const mockComps = schemaToComponents(schema, formDef.name || page.name);
            if (mockComps.length > 0) {
              setComponents(mockComps);
            } else {
              setComponents(getMockComponents(page.type || "form", page.name));
            }
            // 同步 form_status / schema_version
            if (formDef.version != null) setCurrentVersion(formDef.version);
          } catch (e) {
            console.warn("[loadPage] failed to hydrate form from backend:", e);
            setComponents(getMockComponents(page.type || "form", page.name));
          }
        } else if (page.type === "report" && page.report_id) {
          try {
            const def = await appReportsApi.get(appId, page.report_id);
            if (Array.isArray(def.widgets) && def.widgets.length > 0) {
              setComponents(def.widgets as any);
            } else {
              setComponents(getMockComponents("report", page.name));
            }
          } catch (e) {
            setComponents(getMockComponents("report", page.name));
          }
        } else if (page.type === "dashboard" && page.dashboard_id) {
          try {
            const def = await appDashboardsApi.get(appId, page.dashboard_id);
            if (Array.isArray(def.widgets) && def.widgets.length > 0) {
              setComponents(def.widgets as any);
            } else {
              setComponents(getMockComponents("dashboard", page.name));
            }
          } catch (e) {
            setComponents(getMockComponents("dashboard", page.name));
          }
        } else {
          setComponents(getMockComponents(page.type || "form", page.name));
        }
      }

      // Merge any components already persisted in app_page_components into the
      // in-memory state. The legacy config (filesystem / app_pages.config)
      // remains the source of truth for layout; the DB table is additive.
      try {
        const dbRows = await appPageComponentsApi.list(appId, pageId);
        if (Array.isArray(dbRows) && dbRows.length > 0) {
          setComponents((prev) => {
            const realByKey = new Map(
              dbRows.map((r: AppPageComponent) => [r.componentKey, r.id]),
            );
            // Only overlay ids where the in-memory component shares a type;
            // we don't want to fabricate components that aren't in the layout.
            return prev.map((c) => {
              const realId = realByKey.get(c.type);
              if (realId && !/^real_/.test(c.id)) {
                return { ...c, id: realId };
              }
              return c;
            });
          });
        }
      } catch (mergeErr) {
        console.error("[loadPage] failed to merge app_page_components:", mergeErr);
      }

      lastLoadedPageIdRef.current = pageId;
    } catch (e) { console.error("Failed to load page:", e); }
    setLoading(false);
  }, [appId, pageId]);

  useEffect(() => { loadPage(); }, [loadPage]);

  const savePage = useCallback(async () => {
    if (!appId || !pageId) return;
    setSaving(true);
    try {
      const newVer = currentVersion + 1;
      const newVersion: PageVersion = { version: newVer, timestamp: new Date().toISOString(), components: [...components] };
      const pageDef = { name: pageName, components, version: newVer, versionHistory: [...versions, newVersion].slice(-20) };
      const fileName = `page-${pageId}.json`;
      const files = await filesystemApi.listFiles({ app_id: appId });
      const existing = files?.find((f: any) => f.name === fileName);
      if (existing) {
        await filesystemApi.updateFile(existing.id, { content: JSON.stringify(pageDef, null, 2) });
      } else {
        await filesystemApi.createFile({ app_id: appId, name: fileName, is_dir: false, content: JSON.stringify(pageDef, null, 2) });
      }

      // Mirror the page row + components into the backend. app_pages.config
      // remains the canonical blob; the app_page_components table is the new
      // structured store. We only continue if the page row update succeeds.
      try {
        await appsApi.updatePage(appId, pageId, {
          name: pageName,
          config: JSON.stringify(pageDef),
        } as any);
      } catch (upErr) {
        console.error("[savePage] appsApi.updatePage failed:", upErr);
        // Still proceed to component-level sync: this is best-effort and the
        // filesystem save is already durable.
      }

      // Persist in-place components to the new app_page_components table.
      const { idMap } = await saveComponentsToDb(appId, pageId, components);
      if (idMap.size > 0) {
        // Rewrite any newly-created component ids back into local state so the
        // next save treats them as "real_" and uses update() instead of create().
        setComponents((prev) => prev.map((c) => (idMap.has(c.id) ? { ...c, id: idMap.get(c.id)! } : c)));
      }

      // Mirror form / report / dashboard pages into their dedicated tables
      // (app_forms.schema_json / app_reports.layout_json / app_dashboards.layout_json).
      // Without this the user-visible Tabs in AppOverview would stay empty.
      if (pageData?.type && ["form", "report", "dashboard"].includes(pageData.type)) {
        await mirrorToBusinessTable(
          appId,
          pageId,
          pageData.type,
          pageName,
          pageDef,
          linkedIds,
          setLinkedIds,
        );
      }

      setCurrentVersion(newVer);
      setVersions(prev => [...prev, newVersion]);
      setDirty(false);
    } catch (e) { console.error("Save failed:", e); }
    setSaving(false);
  }, [appId, pageId, currentVersion, components, pageName, versions, pageData?.type, linkedIds]);

  const restoreVersion = useCallback((ver: PageVersion) => {
    setComponents(ver.components);
    setCurrentVersion(ver.version);
    setDirty(false);
  }, []);

  const markDirty = useCallback(() => setDirty(true), []);

  return {
    pageData, pageName, setPageName,
    components, setComponents,
    currentVersion, versions,
    dirty, setDirty,
    saving, device, setDevice,
    showAI, setShowAI,
    selectedCompId, setSelectedCompId,
    loading, loadPage, savePage, restoreVersion, markDirty,
  };
}
