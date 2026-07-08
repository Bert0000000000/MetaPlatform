/**
 * F4.6.17 — Webhook 管理 UI
 *
 *   • 列出已注册的 webhook (按 app 过滤)
 *   • 注册新 webhook → reveal 一次性 secret
 *   • 测试触发 + 重试 + delivery 日志查看
 *
 * 设计点：
 *   • secret 只在创建后展示一次 (whsec_…)，之后列表只显示 fingerprint 前 12 位
 *   • 失败用红色，attempt 数 + last_error 直接显示在表格里
 *   • events 字段用 CSV，简单但和后端约定一致
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Webhook, Plus, RefreshCw, Trash2, Send, AlertTriangle, CheckCircle2, Loader2,
  Clipboard, ClipboardCheck, Zap, Clock,
} from "lucide-react";
import {
  webhooksApi, type WebhookEndpoint, type WebhookDelivery,
} from "@/lib/api";

export function WebhooksPage() {
  const navigate = useNavigate();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    app_id: "default",
    name: "",
    url: "",
    events: "data.created,data.updated,app.published",
    enabled: true,
  });
  const [creating, setCreating] = useState(false);

  // reveal dialog (one-time secret)
  const [revealed, setRevealed] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // deliveries dialog
  const [deliveriesOf, setDeliveriesOf] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await webhooksApi.list();
      setEndpoints(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.url.trim() || !form.app_id.trim()) {
      setError("name / url / app_id 均必填");
      return;
    }
    setCreating(true);
    try {
      const created = await webhooksApi.create({
        app_id: form.app_id.trim(),
        name: form.name.trim(),
        url: form.url.trim(),
        events: form.events.trim() || "*",
        enabled: form.enabled,
      });
      setShowCreate(false);
      setForm({ ...form, name: "", url: "" });
      // Reveal secret exactly once.
      if (created.secret) {
        setRevealed({ id: created.id, name: created.name, secret: created.secret });
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (e: WebhookEndpoint) => {
    try {
      await webhooksApi.update(e.id, { enabled: !e.enabled });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "状态切换失败");
    }
  };

  const remove = async (e: WebhookEndpoint) => {
    if (!confirm(`删除 webhook ${e.name}? 历史 deliveries 也会一起删除。`)) return;
    try {
      await webhooksApi.delete(e.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const trigger = async (e: WebhookEndpoint) => {
    try {
      const r = await webhooksApi.test(e.id, "manual trigger from UI");
      if (!r.ok) setError(`Test failed (status=${r.status ?? "—"}) — see deliveries`);
      if (deliveriesOf === e.id) {
        const rows = await webhooksApi.deliveries(e.id, 20);
        setDeliveries(Array.isArray(rows) ? rows : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "触发失败");
    }
  };

  const openDeliveries = async (id: string) => {
    setDeliveriesOf(id);
    setDeliveriesLoading(true);
    try {
      const rows = await webhooksApi.deliveries(id, 20);
      setDeliveries(Array.isArray(rows) ? rows : []);
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const copySecret = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="size-6 text-emerald-500" />
            Webhook 配置 (F4.6.17)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            配置外部 HTTP 端点，当平台事件触发时推送签名后的 JSON 负载。支持失败重试 (1s/3s) 和交付日志。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/runtime")}>返回</Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className={cn("size-3 mr-1", loading && "animate-spin")} />刷新</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="size-3 mr-1" />新建 Webhook</Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="size-4" />{error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">已注册端点 ({endpoints.length})</CardTitle>
          <CardDescription>secret 仅创建后可见一次，之后只显示前 12 位 fingerprint。</CardDescription>
        </CardHeader>
        <CardContent>
          {endpoints.length === 0 && !loading ? (
            <div className="text-sm text-muted-foreground py-12 text-center border-2 border-dashed rounded">
              暂无 Webhook · 点击右上角 "新建 Webhook" 开始
            </div>
          ) : (
            <div className="divide-y -mx-3">
              {endpoints.map((e) => (
                <div key={e.id} className="px-3 py-3 flex items-center gap-3">
                  <span className={`size-2 rounded-full ${e.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{e.name}</span>
                      <code className="text-[10px] text-muted-foreground">{e.app_id}</code>
                      <code className="text-xs truncate max-w-[260px]">{e.url}</code>
                      {e.enabled ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">enabled</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">disabled</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      events: <code className="text-[10px]">{e.events}</code>
                      <span>·</span>
                      <code className="text-[10px] bg-slate-100 px-1 rounded">{e.secret_fingerprint || "—"}</code>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => trigger(e)} title="立即测试触发">
                    <Send className="size-3 mr-1" />Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openDeliveries(e.id)} title="查看交付日志">
                    <Clock className="size-3 mr-1" />日志
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggle(e)}>
                    {e.enabled ? "停用" : "启用"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(e)} title="删除">
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 Webhook</DialogTitle>
            <DialogDescription>
              配置后会立即返回一个 <code>whsec_…</code> 签名密钥，<b>只会展示一次</b>，请立刻保存。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">App ID</Label>
                <Input value={form.app_id} onChange={(e) => setForm({ ...form, app_id: e.target.value })} />
              </div>
              <div>
                <Label className="text-sm">名称</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="billing-events" />
              </div>
            </div>
            <div>
              <Label className="text-sm">URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook" />
            </div>
            <div>
              <Label className="text-sm">Events (CSV / glob)</Label>
              <Input value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} placeholder="data.created,data.updated,app.published" />
              <div className="flex gap-1 mt-2 flex-wrap">
                {["data.*", "app.*", "process.*", "*"].map((p) => (
                  <Button key={p} type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, events: p })}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              <Zap className="size-3.5 mr-1" />创建并展示密钥
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal dialog — one-time secret */}
      <Dialog open={!!revealed} onOpenChange={(o) => { if (!o) setRevealed(null); setCopied(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-5" />
              Webhook 已注册
            </DialogTitle>
            <DialogDescription>
              请立刻保存以下密钥。它只会显示一次，刷新后无法找回。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">端点：<code>{revealed?.name}</code> ({revealed?.id})</div>
            <div className="flex gap-2 items-stretch">
              <Input
                value={revealed?.secret || ""}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button variant="outline" onClick={copySecret}>
                {copied ? <ClipboardCheck className="size-4" /> : <Clipboard className="size-4" />}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed mt-2">
              接收方在 header 里会收到：
              <ul className="list-disc pl-5 mt-1 font-mono text-[10px]">
                <li>X-Webhook-Signature: sha256=&lt;hex&gt;</li>
                <li>X-Webhook-Timestamp: &lt;unix&gt;</li>
                <li>X-Webhook-Nonce: &lt;hex&gt;</li>
                <li>X-Webhook-Event: &lt;event_type&gt;</li>
              </ul>
              验证签名：<code>HMAC_SHA256(secret, "{`{timestamp}.{nonce}.{body}`}")</code>。
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries dialog */}
      <Dialog open={!!deliveriesOf} onOpenChange={(o) => { if (!o) setDeliveriesOf(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>交付日志 — {deliveriesOf}</DialogTitle>
            <DialogDescription>最近 20 条 attempts（包含重试）</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {deliveriesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="size-4 animate-spin" />加载中…
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">暂无记录</div>
            ) : (
              <div className="divide-y text-xs">
                {deliveries.map((d) => (
                  <div key={d.id} className="py-2 grid grid-cols-[80px,80px,1fr,120px] gap-2 items-baseline">
                    {d.status === "success" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : d.status === "failed" ? (
                      <AlertTriangle className="size-3.5 text-red-600" />
                    ) : (
                      <Loader2 className="size-3.5 animate-spin text-slate-400" />
                    )}
                    <code className="text-[10px] text-muted-foreground">#{d.id}</code>
                    <span>
                      <code className="text-[10px]">{d.event_type}</code>
                      {d.last_error && <span className="text-red-600 ml-2">{d.last_error}</span>}
                      {d.response_body && (
                        <pre className="mt-1 bg-slate-50 px-2 py-1 rounded text-[10px] overflow-x-auto">
                          {d.response_body.slice(0, 200)}
                        </pre>
                      )}
                    </span>
                    <div className="text-right tabular-nums">
                      <div>attempts: {d.attempt}</div>
                      <div className="text-muted-foreground">
                        {d.response_status ? `HTTP ${d.response_status}` : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}