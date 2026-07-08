/**
 * F4.6.13 API Key management UI
 *
 * Admin / developer-only page that lets the caller:
 *   • list all of their tenant's active API keys (id, prefix, scopes,
 *     created_at, last_used_at)
 *   • mint a new key (the plaintext token is shown ONCE in a copyable
 *     dialog, then forgotten by the server)
 *   • revoke a key (soft-delete with revoked_at timestamp; the row
 *     stays around so audits can still see "this key existed on
 *     date X, revoked on date Y")
 *
 * Background: needed because third-party callers can't realistically
 * use the JWT login flow — they need a long-lived bearer credential.
 * The API-side equivalent of an AWS access key.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, BarChart3, CheckCircle2, Clipboard, ClipboardCheck, KeyRound, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { authApi, type ApiKey, type ApiKeyStats } from "@/lib/api";

export default function ApiKeysPage() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // F4.6.16 — last-24h dashboard aggregates (calls, errors, top paths).
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Create-dialog state ─────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createScopes, setCreateScopes] = useState("read");
  const [creating, setCreating] = useState(false);

  // ── Reveal-dialog state ─────────────────────────────────
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // ── F4.6.14 create-time rate-limit input ─────────────────
  const [createRateLimit, setCreateRateLimit] = useState<string>(""); // empty = unlimited

  // ── F4.6.14 per-key rate-limit edit dialog ────────────────
  const [editLimitKey, setEditLimitKey] = useState<ApiKey | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<string>("");
  const [savingLimit, setSavingLimit] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await authApi.apiKeys.list();
      setKeys(Array.isArray(rows) ? rows : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const s = await authApi.apiKeys.stats();
      setStats(s);
    } catch {
      // Stats are non-critical; the keys list still works without them.
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadStats();
    // refresh stats every 60s so the dashboard stays near-realtime
    // without needing a manual reload after a burst of calls
    const t = setInterval(loadStats, 60_000);
    return () => clearInterval(t);
  }, []);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const trimmedRate = createRateLimit.trim();
      const rateLimit = trimmedRate === "" ? null : Number(trimmedRate);
      if (trimmedRate !== "" && (!Number.isInteger(rateLimit) || (rateLimit ?? 0) < 0)) {
        setError("速率限制必须是非负整数，留空表示无限制");
        setCreating(false);
        return;
      }
      const minted = await authApi.apiKeys.create({
        name: createName.trim(),
        scopes: createScopes.trim() || "read",
        rateLimit: rateLimit && rateLimit > 0 ? rateLimit : null,
      });
      // reveal plaintext key exactly once
      setRevealedKey(minted.key);
      setRevealedName(minted.name);
      setShowCreate(false);
      setCreateName("");
      setCreateScopes("read");
      setCreateRateLimit("");
      // refresh list (the new key shows up without the secret)
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const openEditLimit = (k: ApiKey) => {
    setEditLimitKey(k);
    setEditLimitValue(k.rate_limit == null ? "" : String(k.rate_limit));
  };
  const handleSaveLimit = async () => {
    if (!editLimitKey) return;
    const trimmed = editLimitValue.trim();
    let parsed: number | null;
    if (trimmed === "") {
      parsed = null;
    } else {
      parsed = Number(trimmed);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError("速率限制必须是非负整数，留空表示无限制");
        return;
      }
      if (parsed > 100000) {
        setError("速率限制不能超过 100000 req/min");
        return;
      }
    }
    setSavingLimit(true);
    try {
      await authApi.apiKeys.update(editLimitKey.id, { rateLimit: parsed });
      setEditLimitKey(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingLimit(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("确认撤销该 API Key？撤销后无法恢复。")) return;
    try {
      await authApi.apiKeys.revoke(id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "撤销失败");
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto px-6 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="size-6 text-amber-500" />
            API Key 管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            为外部系统签发长期可用的访问凭证。密钥在创建时<strong>仅显示一次</strong>，请立即复制保存。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/runtime")}>
            返回运维后台
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="size-3.5 mr-1" />刷新
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="size-3.5 mr-1" />新建 API Key
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      {/* F4.6.16 — last-24h call statistics */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4" />
              调用统计 (近 24 小时)
            </CardTitle>
            {statsLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <CardDescription>
            来自 ring-buffer 实时数据 + 每分钟落库的历史数据合并计算。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <>
              {/* Top 4 metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Metric label="总调用" value={stats.summary.calls} accent="text-blue-600" />
                <Metric label="错误数" value={stats.summary.errors} accent="text-amber-600" />
                <Metric label="限流命中" value={stats.summary.rate_limited} accent="text-red-600" />
                <Metric label="活跃 Key" value={stats.summary.active_keys} accent="text-emerald-600" />
              </div>

              {/* 24h hourly timeline (CSS bars, no chart lib) */}
              <div className="mt-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">每小时调用量</div>
                <div className="flex items-end gap-1 h-20">
                  {stats.timeline_24h.map((b) => {
                    const max = Math.max(1, ...stats.timeline_24h.map((x) => x.calls));
                    const h = Math.max(2, Math.round((b.calls / max) * 76));
                    return (
                      <div key={b.hour} className="flex-1 group relative">
                        <div
                          className="bg-blue-500/70 hover:bg-blue-500 rounded-t transition"
                          style={{ height: `${h}px` }}
                          title={`${b.hour} · ${b.calls} 次`}
                        />
                        <span className="text-[9px] text-muted-foreground absolute -bottom-4 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap bg-slate-800 text-white px-1 py-0.5 rounded z-10">
                          {b.calls}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top paths */}
              {stats.top_paths_24h.length > 0 && (
                <div className="mt-8">
                  <div className="text-xs font-medium text-muted-foreground mb-2">最热路径</div>
                  <div className="space-y-1">
                    {stats.top_paths_24h.map((p) => (
                      <div key={p.path} className="flex items-center gap-2 text-sm">
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded flex-1 truncate">{p.path}</code>
                        <span className="text-muted-foreground text-xs tabular-nums">{p.calls} 次</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">
              暂无统计数据（首次刷新需要 ~1 分钟让 scheduler 把 ring 缓冲落库）
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">活跃的 Key</CardTitle>
          <CardDescription>每个 Key 对应一组授予的作用域（scopes），外部系统通过 HTTP header 透传：<code className="text-xs">X-API-Key: mp_live_…</code> 或 <code className="text-xs">Authorization: Bearer mp_live_…</code>。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <div className="h-12 rounded bg-slate-100 animate-pulse" />
              <div className="h-12 rounded bg-slate-100 animate-pulse" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Loader2 className="size-3.5 animate-spin" />加载中…
              </div>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center border-2 border-dashed rounded">
              还没有签发任何 API Key。
              <div className="mt-3">
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="size-3.5 mr-1" />立即创建
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{k.name}</span>
                      <code className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        {k.key_prefix}…
                      </code>
                      {k.scopes.split(",").map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      {/* F4.6.14 rate-limit chip — click to edit */}
                      <button
                        type="button"
                        onClick={() => openEditLimit(k)}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border hover:bg-slate-100 transition"
                        title="点击修改速率限制"
                      >
                        {k.rate_limit == null ? (
                          <span className="text-slate-500">∞ 无限制</span>
                        ) : (
                          <span className="text-blue-700">{k.rate_limit} req/min</span>
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      创建于 {new Date(k.created_at).toLocaleString()} · 最近使用：{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "从未使用"}
                      {k.expires_at && ` · 到期 ${new Date(k.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(k.id)}>
                    <Trash2 className="size-3.5 mr-1" />撤销
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create dialog ─────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 API Key</DialogTitle>
            <DialogDescription>
              为该 Key 取一个可识别的名称，并指定授予的 scopes（逗号分隔，例如 <code>read,write</code>）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">名称</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="如：CRM 集成 / 数据上报 / Webhook 回调"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm">Scopes（CSV）</Label>
              <Input
                value={createScopes}
                onChange={(e) => setCreateScopes(e.target.value)}
                placeholder="read,write"
              />
              <p className="text-xs text-muted-foreground mt-1">
                常用 scopes：<code>read</code>、<code>write</code>、<code>admin</code>、<code>publish</code>
              </p>
            </div>
            {/* F4.6.14 — per-key rate-limit. Empty = unlimited. */}
            <div>
              <Label className="text-sm">速率限制（req/min）</Label>
              <Input
                value={createRateLimit}
                onChange={(e) => setCreateRateLimit(e.target.value)}
                placeholder="留空 = 无限制；例如 60"
                type="number"
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                超出后该 Key 的请求会被拒绝（HTTP 429 + Retry-After 头）。可在创建后点击 chip 调整。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>取消</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || creating}>
              {creating && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              创建并显示密钥
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal plaintext key dialog (one-shot) ────── */}
      <Dialog open={!!revealedKey} onOpenChange={(open) => !open && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="size-5" />
              API Key 创建成功
            </DialogTitle>
            <DialogDescription>
              <strong className="text-red-600">请立即复制下方密钥并妥善保管！</strong>关闭此弹窗后将无法再次查看完整密钥。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">{revealedName}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all bg-slate-900 text-green-300 px-3 py-2 rounded text-sm font-mono">
                {revealedKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? <ClipboardCheck className="size-4 text-green-600" /> : <Clipboard className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              使用示例：
              <code className="block bg-slate-50 mt-1 px-2 py-1 rounded text-xs">
                curl -H "X-API-Key: {revealedKey?.slice(0, 16)}…" http://localhost:3001/api/apps
              </code>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── F4.6.14 Edit rate-limit dialog ─────────────────── */}
      <Dialog open={!!editLimitKey} onOpenChange={(open) => !open && setEditLimitKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改速率限制</DialogTitle>
            <DialogDescription>
              对 <code>{editLimitKey?.name}</code> ({editLimitKey?.key_prefix}…) 调整每分钟允许的最大请求数。
              留空表示无限制。修改立即生效，无须轮换密钥。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">req/min</Label>
              <Input
                value={editLimitValue}
                onChange={(e) => setEditLimitValue(e.target.value)}
                placeholder="留空 = 无限制；例如 60"
                type="number"
                min={0}
                autoFocus
              />
              <div className="flex gap-1 mt-2 flex-wrap">
                {[10, 60, 600, 6000].map((preset) => (
                  <Button key={preset} type="button" variant="outline" size="sm"
                          onClick={() => setEditLimitValue(String(preset))}>
                    {preset}
                  </Button>
                ))}
                <Button type="button" variant="ghost" size="sm"
                        onClick={() => setEditLimitValue("")}>
                  ∞ 无限制
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditLimitKey(null)} disabled={savingLimit}>取消</Button>
            <Button onClick={handleSaveLimit} disabled={savingLimit}>
              {savingLimit && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small inline metric card used in the F4.6.16 stats dashboard above.
function Metric({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="border rounded-lg px-3 py-2 bg-white">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"text-2xl font-semibold tabular-nums " + (accent ?? "text-slate-800")}>
        {value}
      </div>
    </div>
  );
}