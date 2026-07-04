import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Key, Globe, Bell, Link2, Shield, Webhook, Eye, EyeOff, BookOpen, Hash, MessageCircle, MessagesSquare, Save, Loader2, Check, Copy } from "lucide-react";

/* ── Toast helper ── */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, setToast };
}

/* ── Initial config state ── */
interface AppConfigState {
  // 权限
  publicAccess: boolean;
  requireApproval: boolean;
  rowPermission: boolean;
  fieldPermission: boolean;
  maskingRule: string;
  // 通知渠道
  notifications: Record<string, boolean>;
  // OpenAPI
  apiKey: string;
  rateLimit: string;
  // Webhooks
  webhooks: { url: string; status: string }[];
  // IM 集成
  imIntegrations: Record<string, string>;
}

const INITIAL_CONFIG: AppConfigState = {
  publicAccess: false,
  requireApproval: true,
  rowPermission: true,
  fieldPermission: true,
  maskingRule: "未配置",
  notifications: {
    "邮件通知": true,
    "短信通知": false,
    "飞书": true,
    "钉钉": false,
    "企微": true,
    "应用内通知": true,
  },
  apiKey: "mp_sk_live_5j2k4l3m2n1o0p9q8r7s6t5u4v3w2x1y0z",
  rateLimit: "1000 次/分钟",
  webhooks: [
    { url: "https://your-app.com/webhook", status: "活跃" },
  ],
  imIntegrations: {
    "飞书": "未配置",
    "钉钉": "未配置",
    "企微": "未配置",
    "Teams": "未配置",
  },
};

export default function AppConfig() {
  const [showKey, setShowKey] = useState(false);
  const [config, setConfig] = useState<AppConfigState>(INITIAL_CONFIG);
  const [saving, setSaving] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const { toast, setToast } = useToast();

  /* ── Save config ── */
  async function handleSave() {
    setSaving(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setToast("配置已保存");
  }

  /* ── Regenerate API Key ── */
  async function handleRegenerateKey() {
    setRegeneratingKey(true);
    await new Promise((r) => setTimeout(r, 1000));
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let newKey = "mp_sk_live_";
    for (let i = 0; i < 40; i++) newKey += chars[Math.floor(Math.random() * chars.length)];
    setConfig((c) => ({ ...c, apiKey: newKey }));
    setRegeneratingKey(false);
    setToast("API Key 已重新生成");
  }

  /* ── Copy API Key ── */
  function handleCopyKey() {
    navigator.clipboard.writeText(config.apiKey).then(() => {
      setToast("API Key 已复制到剪贴板");
    });
  }

  /* ── Add Webhook ── */
  function handleAddWebhook() {
    if (!newWebhookUrl.trim()) return;
    setConfig((c) => ({
      ...c,
      webhooks: [...c.webhooks, { url: newWebhookUrl.trim(), status: "活跃" }],
    }));
    setNewWebhookUrl("");
    setWebhookDialogOpen(false);
    setToast("Webhook 添加成功");
  }

  /* ── Remove Webhook ── */
  function handleRemoveWebhook(index: number) {
    setConfig((c) => ({
      ...c,
      webhooks: c.webhooks.filter((_, i) => i !== index),
    }));
    setToast("Webhook 已删除");
  }

  /* ── Toggle notification channel ── */
  function handleToggleNotification(name: string) {
    setConfig((c) => ({
      ...c,
      notifications: { ...c.notifications, [name]: !c.notifications[name] },
    }));
  }

  /* ── Toggle permission switches ── */
  function handleTogglePermission(key: "publicAccess" | "requireApproval" | "rowPermission" | "fieldPermission") {
    setConfig((c) => ({ ...c, [key]: !c[key] }));
  }

  /* ── Open IM config dialog (simulated) ── */
  function handleConfigIM(name: string) {
    setToast(`${name} 集成配置向导已打开（功能开发中）`);
  }

  /* ── Open SSO config (simulated) ── */
  function handleConfigSSO() {
    setToast("SSO 配置向导已打开（功能开发中）");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="应用配置"
        description="权限 + 通知 + OpenAPI + 集成"
        action={
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存配置
          </Button>
        }
      />

      <Tabs defaultValue="permission" orientation="vertical">
        <div className="flex gap-4">
          <TabsList className="flex-col h-fit w-48 bg-transparent p-0 gap-1">
            <TabsTrigger value="permission" className="w-full justify-start data-[state=active]:bg-muted">
              <Shield className="size-4 mr-2" /> 权限
            </TabsTrigger>
            <TabsTrigger value="notification" className="w-full justify-start data-[state=active]:bg-muted">
              <Bell className="size-4 mr-2" /> 通知
            </TabsTrigger>
            <TabsTrigger value="openapi" className="w-full justify-start data-[state=active]:bg-muted">
              <Key className="size-4 mr-2" /> OpenAPI
            </TabsTrigger>
            <TabsTrigger value="integration" className="w-full justify-start data-[state=active]:bg-muted">
              <Link2 className="size-4 mr-2" /> 集成
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 space-y-4">
            {/* 权限配置 */}
            <TabsContent value="permission" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">应用权限</CardTitle>
                  <CardDescription>谁能访问这个应用</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">公开访问</div>
                      <div className="text-xs text-muted-foreground">所有人都可以查看</div>
                    </div>
                    <Switch
                      checked={config.publicAccess}
                      onCheckedChange={() => handleTogglePermission("publicAccess")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">需要审批</div>
                      <div className="text-xs text-muted-foreground">新用户访问需审批</div>
                    </div>
                    <Switch
                      checked={config.requireApproval}
                      onCheckedChange={() => handleTogglePermission("requireApproval")}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">数据权限</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>行级权限</span>
                    <Badge variant={config.rowPermission ? "default" : "secondary"}>
                      {config.rowPermission ? "启用" : "禁用"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>字段级权限</span>
                    <Badge variant={config.fieldPermission ? "default" : "secondary"}>
                      {config.fieldPermission ? "启用" : "禁用"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>脱敏规则</span>
                    <Badge variant="secondary">{config.maskingRule}</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 通知配置 */}
            <TabsContent value="notification" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">通知渠道</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "邮件通知", desc: "通过 SMTP 发送邮件" },
                    { name: "短信通知", desc: "通过阿里云/腾讯云发送" },
                    { name: "飞书", desc: "飞书机器人/Webhook" },
                    { name: "钉钉", desc: "钉钉机器人/Webhook" },
                    { name: "企微", desc: "企业微信应用消息" },
                    { name: "应用内通知", desc: "站内消息中心" },
                  ].map((ch) => (
                    <div key={ch.name} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{ch.name}</div>
                        <div className="text-xs text-muted-foreground">{ch.desc}</div>
                      </div>
                      <Switch
                        checked={config.notifications[ch.name] ?? false}
                        onCheckedChange={() => handleToggleNotification(ch.name)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                  保存通知设置
                </Button>
              </div>
            </TabsContent>

            {/* OpenAPI */}
            <TabsContent value="openapi" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API Key</CardTitle>
                  <CardDescription>使用此 Key 调用本应用的 OpenAPI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={config.apiKey}
                      readOnly
                      className="font-mono"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleCopyKey} title="复制 Key">
                      <Copy className="size-4" />
                    </Button>
                    <Button variant="outline" onClick={handleRegenerateKey} disabled={regeneratingKey}>
                      {regeneratingKey ? <Loader2 className="size-4 animate-spin mr-1" /> : <Key className="size-4 mr-1" />}
                      重新生成
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>限流：</span>
                      <Badge>{config.rateLimit}</Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setToast("API 文档已打开（功能开发中）")}>
                      查看 API 文档
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API 列表</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span>GET /api/v1/apps/{`{id}`}</span>
                      <Badge variant="outline">公开</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span>POST /api/v1/apps/{`{id}`}/instances</span>
                      <Badge>已认证</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                      <span>POST /api/v1/apps/{`{id}`}/processes/{`{key}`}/start</span>
                      <Badge>已认证</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Webhook className="size-4" /> Webhook
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {config.webhooks.map((wh, i) => (
                      <div key={i} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                        <span className="font-mono text-xs truncate flex-1 mr-2">{wh.url}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{wh.status}</Badge>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleRemoveWebhook(i)}>
                            删除
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setWebhookDialogOpen(true)}>
                      + 添加 Webhook
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 集成 */}
            <TabsContent value="integration" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">IM 集成</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "飞书", icon: BookOpen },
                    { name: "钉钉", icon: Hash },
                    { name: "企微", icon: MessageCircle },
                    { name: "Teams", icon: MessagesSquare },
                  ].map((im) => (
                    <div key={im.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <im.icon className="size-5" />
                        <div>
                          <div className="font-medium text-sm">{im.name}</div>
                          <div className="text-xs text-muted-foreground">{config.imIntegrations[im.name] || "未配置"}</div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleConfigIM(im.name)}>
                        配置
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="size-4" /> 单点登录 (SSO)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-3">配置 OAuth2 / SAML 2.0</div>
                  <Button variant="outline" size="sm" onClick={handleConfigSSO}>
                    配置 SSO
                  </Button>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                  保存集成设置
                </Button>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* 添加 Webhook 对话框 */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 Webhook</DialogTitle>
            <DialogDescription>配置一个 Webhook URL 接收事件回调</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://your-app.com/webhook"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddWebhook}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}