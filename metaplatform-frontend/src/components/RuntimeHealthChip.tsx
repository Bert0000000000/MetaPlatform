/**
 * Shared runtime-health indicator.
 *
 * Two pages — Dashboard and AppPublish — show this exact chip so that
 * the "docker daemon unreachable" state is communicated consistently
 * across the whole product. Hidden when `docker === "ok"`.
 *
 * Behaviour:
 *   - GET /api/runtime/health on mount (single attempt; no retry).
 *   - On error, still renders as degraded with reason "health check failed"
 *     so a transient network blip doesn't make the chip flicker.
 *   - Clicking routes to /admin/runtime for the full status table.
 */
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { appsApi } from "@/lib/api";

interface Health {
  docker: "ok" | "degraded";
  error?: string;
}

export function RuntimeHealthChip() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    appsApi.getRuntimeHealth()
      .then((h) => { if (alive) setHealth(h as Health); })
      .catch(() => { if (alive) setHealth({ docker: "degraded", error: "health check failed" }); });
    return () => { alive = false; };
  }, []);

  if (!health || health.docker === "ok") return null;
  return (
    <a
      href="/admin/runtime"
      className="block rounded-lg border border-yellow-500/40 bg-primary dark:bg-primary/20 px-4 py-3 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
      title="运行时监控"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
            运行时未隔离（Docker 不可达）
          </p>
          <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
            {health.error ? `原因: ${health.error}。` : ""}
            已发布应用将以
            <span className="font-mono mx-1">快照降级</span>
            模式在进程内运行（每个 app 独立 sqlite，但不再独立容器）。
          </p>
        </div>
        <span className="text-yellow-700 dark:text-yellow-300 text-sm whitespace-nowrap">查看监控 →</span>
      </div>
    </a>
  );
}

export default RuntimeHealthChip;
