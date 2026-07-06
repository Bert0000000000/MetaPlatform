import { useState, useEffect, useCallback } from "react";
import { appsApi, filesystemApi } from "@/lib/api";
import type { PageComponent, PageVersion } from "./types";

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

  const loadPage = useCallback(async () => {
    if (!appId || !pageId) { setLoading(false); return; }
    try {
      const pages = await appsApi.listPages(appId);
      const page = pages?.find((p: any) => p.id === pageId);
      if (page) { setPageData(page); setPageName(page.name); }
      const files = await filesystemApi.listFiles({ app_id: appId });
      const configFile = files?.find((f: any) => f.name === `page-${pageId}.json`);
      if (configFile?.content) {
        const parsed = JSON.parse(configFile.content);
        if (parsed.components) setComponents(parsed.components);
        if (parsed.version) setCurrentVersion(parsed.version);
        if (parsed.versionHistory) setVersions(parsed.versionHistory);
      }
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
      setCurrentVersion(newVer);
      setVersions(prev => [...prev, newVersion]);
      setDirty(false);
    } catch (e) { console.error("Save failed:", e); }
    setSaving(false);
  }, [appId, pageId, currentVersion, components, pageName, versions]);

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
