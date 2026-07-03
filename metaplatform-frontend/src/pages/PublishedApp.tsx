import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Smartphone,
  ChevronRight,
  Menu,
  X,
  Home,
  Loader2,
  AlertCircle,
} from "lucide-react";
import PublishedPage from "./PublishedPage";

/* ─── Types ─────────────────────────────────────────────── */

interface AppPage {
  id: string;
  name: string;
  icon?: string;
  path?: string;
  schema?: unknown;
}

interface PublishedAppData {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  pages?: AppPage[];
  published_version?: string;
  published_at?: string;
}

/* ─── Component ─────────────────────────────────────────── */

export default function PublishedApp() {
  const { slug, pageId } = useParams<{ slug: string; pageId?: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<PublishedAppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(pageId || null);

  /* Fetch published app by slug */
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    fetch(`/api/apps/slug/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setApp(json.data);
          // Default to first page if no pageId specified
          const pages = json.data.pages;
          if (!pageId && pages && pages.length > 0) {
            setActivePageId(pages[0].id);
          }
        } else {
          setError(json.error || "应用未找到");
        }
      })
      .catch((err) => setError("加载失败: " + err.message))
      .finally(() => setLoading(false));
  }, [slug, pageId]);

  /* Sync pageId from URL */
  useEffect(() => {
    if (pageId) setActivePageId(pageId);
  }, [pageId]);

  const handlePageSelect = useCallback(
    (pId: string) => {
      setActivePageId(pId);
      setSidebarOpen(false);
      if (slug) {
        navigate(`/app/${slug}/page/${pId}`, { replace: true });
      }
    },
    [slug, navigate]
  );

  const pages: AppPage[] = app?.pages || [];
  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  /* ─── Loading state ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="size-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading application...</p>
        </div>
      </div>
    );
  }

  /* ─── Error state ───────────────────────────────────────── */
  if (error || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="size-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Application Unavailable</h2>
          <p className="text-sm text-gray-500">{error || "The requested application could not be loaded."}</p>
        </div>
      </div>
    );
  }

  /* ─── Main layout ───────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ── Top Header ────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 shrink-0 z-30">
        {/* Mobile menu toggle */}
        {pages.length > 0 && (
          <button
            className="lg:hidden mr-3 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        )}

        {/* App identity */}
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Smartphone className="size-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">{app.name}</h1>
            {app.description && (
              <p className="text-xs text-gray-400 leading-tight truncate max-w-[200px]">
                {app.description}
              </p>
            )}
          </div>
        </div>

        {/* Right side spacer */}
        <div className="ml-auto flex items-center gap-2">
          {app.published_version && (
            <span className="text-xs text-gray-400">{app.published_version}</span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar Navigation ──────────────────────────── */}
        {pages.length > 0 && (
          <>
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/30 z-20 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <aside
              className={`
                fixed lg:static inset-y-14 left-0 z-20
                w-60 bg-white border-r border-gray-200
                transform transition-transform duration-200 ease-in-out
                ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                flex flex-col shrink-0
              `}
            >
              <nav className="flex-1 overflow-y-auto py-3 px-2">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-2">
                  Navigation
                </div>
                {pages.map((page) => {
                  const isActive = page.id === (activePage?.id);
                  return (
                    <button
                      key={page.id}
                      onClick={() => handlePageSelect(page.id)}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5
                        transition-colors text-left
                        ${
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }
                      `}
                    >
                      <Home className="size-4 shrink-0" />
                      <span className="truncate">{page.name || page.id}</span>
                      {isActive && <ChevronRight className="size-3.5 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </nav>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                Powered by MetaPlatform
              </div>
            </aside>
          </>
        )}

        {/* ── Page Content ────────────────────────────────── */}
        <main className="flex-1 overflow-auto">
          {activePage ? (
            <PublishedPage page={activePage} app={app} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Smartphone className="size-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No pages configured</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
