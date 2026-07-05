import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { appsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Key, Globe, Bell, Link2, Shield, Webhook, Eye, EyeOff, BookOpen, Hash, MessageCircle, MessagesSquare, Save, Loader2, Check, Copy, Send, ArrowRight, Clock, Zap, FileText, RefreshCw, Trash2, Plus, ExternalLink, Lock, Users, Building2, Sliders, ShieldCheck, TestTube2, Workflow, ChevronRight, ChevronDown, Pencil, Wand2, Crosshair, Layers, Gauge, ArrowLeftRight, Scale, Percent, FastForward, Rewind, ToggleLeft, UserPlus, UserCheck, MoveRight, StopCircle, Wrench, Settings, Image, Upload, Server } from "lucide-react";

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

/* ── API endpoint mock data ── */
// TODO: Replace with real API when backend ready (no OpenAPI spec endpoint exists)
const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/apps/{id}", auth: "公开", desc: "获取应用详情", tags: ["应用"] },
  { method: "POST", path: "/api/v1/apps/{id}/instances", auth: "已认证", desc: "创建实例", tags: ["实例"] },
  { method: "GET", path: "/api/v1/apps/{id}/instances", auth: "已认证", desc: "查询实例列表", tags: ["实例"] },
  { method: "PUT", path: "/api/v1/apps/{id}/instances/{instanceId}", auth: "已认证", desc: "更新实例", tags: ["实例"] },
  { method: "DELETE", path: "/api/v1/apps/{id}/instances/{instanceId}", auth: "已认证", desc: "删除实例", tags: ["实例"] },
  { method: "POST", path: "/api/v1/apps/{id}/processes/{key}/start", auth: "已认证", desc: "启动流程", tags: ["流程"] },
  { method: "GET", path: "/api/v1/apps/{id}/processes/{key}/instances", auth: "已认证", desc: "流程实例列表", tags: ["流程"] },
  { method: "POST", path: "/api/v1/apps/{id}/webhooks/test", auth: "已认证", desc: "测试 Webhook", tags: ["Webhook"] },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-orange-100 text-orange-700",
  DELETE: "bg-red-100 text-red-700",
  PATCH: "bg-purple-100 text-purple-700",
};

// TODO: Replace with real API when backend ready (adminApi.listConfig() exists but does not cover app-level config)
/* ── Initial config state ── */
interface AppConfigState {
  publicAccess: boolean;
  requireApproval: boolean;
  rowPermission: boolean;
  fieldPermission: boolean;
  maskingRule: string;
  notifications: Record<string, boolean>;
  apiKey: string;
  rateLimit: string;
  rateLimitValue: number;
  rateLimitWindow: string;
  webhooks: { url: string; events: string[]; status: string; secret?: string }[];
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
  rateLimitValue: 1000,
  rateLimitWindow: "minute",
  webhooks: [
    { url: "https://your-app.com/webhook", events: ["instance.created", "process.completed"], status: "活跃" },
  ],
  imIntegrations: {
    "飞书": "未配置",
    "钉钉": "未配置",
    "企微": "未配置",
    "Teams": "未配置",
  },
};

/* ── API Tester state ── */
interface APITestResult {
  status: number;
  statusText: string;
  time: number;
  body: string;
}

export default function AppConfig() {
  const { appId } = useParams();
  const [showKey, setShowKey] = useState(false);
  const [config, setConfig] = useState<AppConfigState>(INITIAL_CONFIG);
  const [saving, setSaving] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["instance.created"]);
  const { toast, setToast } = useToast();

  /* ── API Tester state ── */
  const [testMethod, setTestMethod] = useState("GET");
  const [testUrl, setTestUrl] = useState("/api/v1/apps/{id}");
  const [testHeaders, setTestHeaders] = useState('{\n  "Authorization": "Bearer YOUR_API_KEY",\n  "Content-Type": "application/json"\n}');
  const [testBody, setTestBody] = useState("{\n  \"name\": \"test\"\n}");
  const [testResult, setTestResult] = useState<APITestResult | null>(null);
  const [testing, setTesting] = useState(false);

  /* ── Rate limit editing state ── */
  const [editingRateLimit, setEditingRateLimit] = useState(false);
  const [rateLimitInput, setRateLimitInput] = useState(config.rateLimitValue.toString());
  const [rateLimitWindowInput, setRateLimitWindowInput] = useState(config.rateLimitWindow);

  async function handleSave() {
    if (!appId) {
      setToast("未找到应用 ID");
      return;
    }
    setSaving(true);
    try {
      // Save config entries via the API
      const configEntries = [
        { key: "publicAccess", value: String(config.publicAccess) },
        { key: "requireApproval", value: String(config.requireApproval) },
        { key: "rowPermission", value: String(config.rowPermission) },
        { key: "fieldPermission", value: String(config.fieldPermission) },
        { key: "apiKey", value: config.apiKey },
        { key: "rateLimitValue", value: String(config.rateLimitValue) },
        { key: "rateLimitWindow", value: config.rateLimitWindow },
        { key: "notifications", value: JSON.stringify(config.notifications) },
        { key: "webhooks", value: JSON.stringify(config.webhooks) },
        { key: "imIntegrations", value: JSON.stringify(config.imIntegrations) },
      ];
      await Promise.all(
        configEntries.map((entry) =>
          appsApi.updateConfig(appId, entry.key, { value: entry.value })
        )
      );
      setToast("配置已保存");
    } catch (e) {
      console.error("保存配置失败:", e);
      setToast("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateKey() {
    setRegeneratingKey(true);
    // TODO: Replace with real API call when appsApi.regenerateApiKey is available
    // const newKey = await appsApi.regenerateApiKey(appId);
    await new Promise((r) => setTimeout(r, 1000));
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let newKey = "mp_sk_live_";
    for (let i = 0; i < 40; i++) newKey += chars[Math.floor(Math.random() * chars.length)];
    setConfig((c) => ({ ...c, apiKey: newKey }));
    setRegeneratingKey(false);
    setToast("API Key 已重新生成");
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(config.apiKey).then(() => {
      setToast("API Key 已复制到剪贴板");
    });
  }

  function handleAddWebhook() {
    if (!newWebhookUrl.trim()) return;
    setConfig((c) => ({
      ...c,
      webhooks: [...c.webhooks, { url: newWebhookUrl.trim(), events: newWebhookEvents, status: "活跃" }],
    }));
    setNewWebhookUrl("");
    setNewWebhookEvents(["instance.created"]);
    setWebhookDialogOpen(false);
    setToast("Webhook 添加成功");
  }

  function handleRemoveWebhook(index: number) {
    setConfig((c) => ({
      ...c,
      webhooks: c.webhooks.filter((_, i) => i !== index),
    }));
    setToast("Webhook 已删除");
  }

  function handleToggleNotification(name: string) {
    setConfig((c) => ({
      ...c,
      notifications: { ...c.notifications, [name]: !c.notifications[name] },
    }));
  }

  function handleTogglePermission(key: "publicAccess" | "requireApproval" | "rowPermission" | "fieldPermission") {
    setConfig((c) => ({ ...c, [key]: !c[key] }));
  }

  /* ── SSO Configuration state ── */
  const [ssoDialogOpen, setSsoDialogOpen] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoProvider, setSsoProvider] = useState("saml");
  const [ssoConfig, setSsoConfig] = useState({
    entityId: "", ssoUrl: "", certificate: "", attributeMapping: '{"email":"email","name":"displayName"}',
    clientId: "", clientSecret: "", authorizationUrl: "", tokenUrl: "", scope: "openid profile email",
    ldapHost: "", ldapPort: "389", baseDn: "", bindDn: "", bindPassword: "", userFilter: "(uid={0})",
  });
  const [testingSSO, setTestingSSO] = useState(false);

  /* ── IM Integration state ── */
  const [imDialogOpen, setImDialogOpen] = useState(false);
  const [imPlatform, setImPlatform] = useState("");
  const [imConfig, setImConfig] = useState({
    appId: "", appSecret: "", webhookUrl: "", botName: "MetaPlatform Bot", botAvatar: "",
    msgEvent: true, taskEvent: true, processEvent: true,
  });
  const [testingIM, setTestingIM] = useState(false);
  const [syncingOrg, setSyncingOrg] = useState(false);
  const [imNotifyRules, setImNotifyRules] = useState<Record<string, string[]>>({
    "飞书": ["流程完成", "审批提醒", "任务分配"],
    "钉钉": ["审批提醒"],
    "企微": ["任务分配", "流程异常"],
    "Teams": [],
  });

  function handleConfigIM(name: string) {
    setImPlatform(name);
    setImDialogOpen(true);
  }

  function handleConfigSSO() {
    setSsoDialogOpen(true);
  }

  async function handleTestSSO() {
    setTestingSSO(true);
    // TODO: Replace with real SSO test API call
    // const result = await authApi.testSSOConnection(ssoProvider, ssoConfig);
    await new Promise((r) => setTimeout(r, 1500));
    setTestingSSO(false);
    setToast("SSO 连接测试成功");
  }

  function handleSaveSSO() {
    setSsoDialogOpen(false);
    setSsoEnabled(true);
    setToast("SSO 配置已保存");
  }

  function handleUpdateSsoField(field: string, value: string) {
    setSsoConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleTestIM() {
    setTestingIM(true);
    // TODO: Replace with real IM test API call
    // const result = await integrationApi.testIM(imPlatform, imConfig);
    await new Promise((r) => setTimeout(r, 1000));
    setTestingIM(false);
    setToast(`${imPlatform} 测试消息已发送`);
  }

  async function handleSyncOrg() {
    setSyncingOrg(true);
    // TODO: Replace with real org sync API call
    // const result = await integrationApi.syncOrganization(imPlatform);
    await new Promise((r) => setTimeout(r, 2000));
    setSyncingOrg(false);
    setToast(`${imPlatform} 组织架构同步完成`);
  }

  function handleSaveIM() {
    setImDialogOpen(false);
    setConfig((c) => ({
      ...c,
      imIntegrations: { ...c.imIntegrations, [imPlatform]: "已配置" },
    }));
    setToast(`${imPlatform} 集成配置已保存`);
  }

  function handleUpdateIMField(field: string, value: string | boolean) {
    setImConfig((prev) => ({ ...prev, [field]: value }));
  }

  function handleToggleIMRule(platform: string, rule: string) {
    setImNotifyRules((prev) => {
      const current = prev[platform] || [];
      const updated = current.includes(rule)
        ? current.filter((r) => r !== rule)
        : [...current, rule];
      return { ...prev, [platform]: updated };
    });
  }

  function handleSaveRateLimit() {
    const val = parseInt(rateLimitInput, 10);
    if (isNaN(val) || val <= 0) {
      setToast("请输入有效的限流数值");
      return;
    }
    const windowLabels: Record<string, string> = { second: "秒", minute: "分钟", hour: "小时", day: "天" };
    setConfig((c) => ({
      ...c,
      rateLimitValue: val,
      rateLimitWindow: rateLimitWindowInput,
      rateLimit: `${val} 次/${windowLabels[rateLimitWindowInput] || "分钟"}`,
    }));
    setEditingRateLimit(false);
    setToast("限流配置已更新");
  }

  // TODO: Replace with real API when backend ready (mockResponses is simulated test data)
  /* ── Run API test ── */
  async function handleRunTest() {
    setTesting(true);
    setTestResult(null);
    const startTime = Date.now();
    // TODO: Replace with real API test call when backend is ready
    // try {
    //   const parsedHeaders = JSON.parse(testHeaders);
    //   const response = await fetch(testUrl, {
    //     method: testMethod,
    //     headers: parsedHeaders,
    //     body: ["POST", "PUT", "PATCH"].includes(testMethod) ? testBody : undefined,
    //   });
    //   const elapsed = Date.now() - startTime;
    //   const body = response.status !== 204 ? await response.text() : "";
    //   setTestResult({ status: response.status, statusText: response.statusText, time: elapsed, body });
    // } catch (err: any) {
    //   setTestResult({ status: 0, statusText: "Network Error", time: Date.now() - startTime, body: err.message });
    // }
    // --- Simulation fallback (remove when real API is connected) ---
    await new Promise((r) => setTimeout(r, 800));
    const mockResponses: Record<string, APITestResult> = {
      GET: {
        status: 200,
        statusText: "OK",
        time: 67,
        body: JSON.stringify({
          id: "app_001",
          name: "销售管理系统",
          status: "published",
          version: "1.2.0",
          createdAt: "2026-01-15T08:30:00Z",
          instances: 1234,
        }, null, 2),
      },
      POST: {
        status: 201,
        statusText: "Created",
        time: 123,
        body: JSON.stringify({
          id: "inst_789",
          appId: "app_001",
          status: "active",
          createdAt: new Date().toISOString(),
          data: { name: "test" },
        }, null, 2),
      },
      PUT: {
        status: 200,
        statusText: "OK",
        time: 78,
        body: JSON.stringify({
          id: "inst_789",
          updatedAt: new Date().toISOString(),
          changes: 1,
        }, null, 2),
      },
      DELETE: {
        status: 204,
        statusText: "No Content",
        time: 42,
        body: "",
      },
    };
    setTestResult(mockResponses[testMethod] || mockResponses.GET);
    setTesting(false);
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
            <TabsTrigger value="cover" className="w-full justify-start data-[state=active]:bg-muted">
              <Image className="size-4 mr-2" /> 封面
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
                    <Switch checked={config.publicAccess} onCheckedChange={() => handleTogglePermission("publicAccess")} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">需要审批</div>
                      <div className="text-xs text-muted-foreground">新用户访问需审批</div>
                    </div>
                    <Switch checked={config.requireApproval} onCheckedChange={() => handleTogglePermission("requireApproval")} />
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

            {/* F4.6.3 应用封面 */}
            <TabsContent value="cover" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="size-4" /> 应用封面
                  </CardTitle>
                  <CardDescription>上传应用封面图片，用于应用市场和工作台展示</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                    <Upload className="size-10 mx-auto mb-3 text-muted-foreground" />
                    <div className="text-sm font-medium">点击或拖拽上传封面图片</div>
                    <div className="text-xs text-muted-foreground mt-1">支持 JPG、PNG 格式，建议尺寸 1200x630px，最大 2MB</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: "默认渐变", color: "from-blue-500 to-purple-600" },
                      { name: "商务蓝", color: "from-sky-400 to-blue-600" },
                      { name: "活力橙", color: "from-orange-400 to-red-500" },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className={`h-24 rounded-lg bg-gradient-to-r ${preset.color} flex items-end p-2 hover:ring-2 ring-primary transition-all`}
                      >
                        <span className="text-xs font-medium text-white drop-shadow">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                      保存封面
                    </Button>
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
              {/* API Key */}
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
                      {regeneratingKey ? <Loader2 className="size-4 animate-spin mr-1" /> : <RefreshCw className="size-4 mr-1" />}
                      重新生成
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Rate Limiting Config */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="size-4" /> API 限流配置
                  </CardTitle>
                  <CardDescription>限制 API 调用频率，防止滥用</CardDescription>
                </CardHeader>
                <CardContent>
                  {editingRateLimit ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">请求次数</Label>
                          <Input
                            type="number"
                            value={rateLimitInput}
                            onChange={(e) => setRateLimitInput(e.target.value)}
                            placeholder="1000"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">时间窗口</Label>
                          <select
                            className="w-full border rounded px-3 py-2 text-sm bg-background"
                            value={rateLimitWindowInput}
                            onChange={(e) => setRateLimitWindowInput(e.target.value)}
                          >
                            <option value="second">每秒</option>
                            <option value="minute">每分钟</option>
                            <option value="hour">每小时</option>
                            <option value="day">每天</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveRateLimit}>保存</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingRateLimit(false)}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="size-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{config.rateLimit}</div>
                          <div className="text-xs text-muted-foreground">当前限流配置</div>
                        </div>
                        <Badge>{config.rateLimit}</Badge>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setRateLimitInput(config.rateLimitValue.toString());
                        setRateLimitWindowInput(config.rateLimitWindow);
                        setEditingRateLimit(true);
                      }}>
                        修改
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* OpenAPI 3.0 Spec Viewer */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="size-4" /> OpenAPI 3.0 规范
                  </CardTitle>
                  <CardDescription>查看和下载应用的 OpenAPI 规范文档</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      符合 OpenAPI 3.0.3 规范，支持 Swagger UI 交互式文档
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.open("/api/docs", "_blank")}>
                        <ExternalLink className="size-3 mr-1" /> Swagger UI
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setToast("openapi.json 已下载")}>
                        <FileText className="size-3 mr-1" /> 下载 Spec
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Endpoint List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API 端点列表</CardTitle>
                  <CardDescription>自动生成自应用对象和流程的 API 端点</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {API_ENDPOINTS.map((ep, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer group">
                        <Badge className={`${METHOD_COLORS[ep.method]} font-mono text-[10px] w-16 justify-center`}>
                          {ep.method}
                        </Badge>
                        <span className="font-mono text-xs flex-1">{ep.path}</span>
                        <span className="text-xs text-muted-foreground">{ep.desc}</span>
                        <Badge variant={ep.auth === "公开" ? "outline" : "secondary"} className="text-[10px]">
                          {ep.auth}
                        </Badge>
                        {ep.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Webhook Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Webhook className="size-4" /> Webhook 管理
                  </CardTitle>
                  <CardDescription>配置 Webhook 接收事件回调</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {config.webhooks.map((wh, i) => (
                      <div key={i} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs truncate flex-1 mr-2">{wh.url}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">{wh.status}</Badge>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleRemoveWebhook(i)}>
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {wh.events.map((ev) => (
                            <Badge key={ev} variant="secondary" className="text-[10px]">{ev}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setWebhookDialogOpen(true)}>
                      <Plus className="size-3 mr-1" /> 添加 Webhook
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Interactive API Tester */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="size-4" /> API 测试器
                  </CardTitle>
                  <CardDescription>交互式测试 API 端点</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Method + URL */}
                  <div className="flex gap-2">
                    <select
                      className="border rounded px-3 py-2 text-sm font-mono bg-background w-28"
                      value={testMethod}
                      onChange={(e) => setTestMethod(e.target.value)}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                    <Input
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      placeholder="/api/v1/apps/{id}"
                      className="font-mono text-sm flex-1"
                    />
                    <Button onClick={handleRunTest} disabled={testing} className="gap-1">
                      {testing ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                      发送
                    </Button>
                  </div>

                  {/* Headers */}
                  <div>
                    <Label className="text-xs mb-1 block">请求头 (JSON)</Label>
                    <textarea
                      className="w-full border rounded p-2 text-xs font-mono bg-background h-20 resize-none"
                      value={testHeaders}
                      onChange={(e) => setTestHeaders(e.target.value)}
                    />
                  </div>

                  {/* Body */}
                  {(testMethod === "POST" || testMethod === "PUT" || testMethod === "PATCH") && (
                    <div>
                      <Label className="text-xs mb-1 block">请求体 (JSON)</Label>
                      <textarea
                        className="w-full border rounded p-2 text-xs font-mono bg-background h-24 resize-none"
                        value={testBody}
                        onChange={(e) => setTestBody(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Response */}
                  {testResult && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                        <div className="flex items-center gap-2">
                          <Badge variant={testResult.status < 400 ? "default" : "destructive"}>
                            {testResult.status} {testResult.statusText}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{testResult.time}ms</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                          navigator.clipboard.writeText(testResult.body);
                          setToast("响应已复制");
                        }}>
                          <Copy className="size-3 mr-1" /> 复制
                        </Button>
                      </div>
                      <pre className="p-3 text-xs font-mono bg-[#1e1e1e] text-green-400 overflow-auto max-h-48">
                        {testResult.body || "(Empty Response)"}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 集成 */}
            <TabsContent value="integration" className="mt-0 space-y-4">
              {/* ── IM 集成 ── */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="size-4" /> IM 集成
                  </CardTitle>
                  <CardDescription>配置即时通讯平台集成，支持消息推送和组织架构同步</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "飞书", icon: BookOpen, desc: "飞书机器人 / Webhook / 事件订阅" },
                    { name: "钉钉", icon: Hash, desc: "钉钉机器人 / Webhook / 工作通知" },
                    { name: "企微", icon: MessageCircle, desc: "企业微信应用消息 / 群机器人" },
                    { name: "Teams", icon: MessagesSquare, desc: "Microsoft Teams Bot / Webhook" },
                  ].map((im) => {
                    const configured = config.imIntegrations[im.name] === "已配置";
                    const rules = imNotifyRules[im.name] || [];
                    return (
                      <div key={im.name} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <im.icon className="size-5" />
                            <div>
                              <div className="font-medium text-sm">{im.name}</div>
                              <div className="text-xs text-muted-foreground">{im.desc}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={configured ? "default" : "secondary"}>
                              {configured ? "已配置" : "未配置"}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={() => handleConfigIM(im.name)}>
                              {configured ? "编辑" : "配置"}
                            </Button>
                          </div>
                        </div>
                        {configured && rules.length > 0 && (
                          <div className="flex items-center gap-2 pt-1 border-t">
                            <span className="text-xs text-muted-foreground">通知规则:</span>
                            {rules.map((rule) => (
                              <Badge key={rule} variant="secondary" className="text-[10px]">{rule}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* ── SSO 配置 ── */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="size-4" /> 单点登录 (SSO)
                  </CardTitle>
                  <CardDescription>配置 SAML 2.0 / OAuth 2.0 / OIDC / LDAP 单点登录</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="size-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">SSO 状态</div>
                        <div className="text-xs text-muted-foreground">
                          {ssoEnabled ? `已启用 · ${ssoProvider === "saml" ? "SAML 2.0" : ssoProvider === "oauth" ? "OAuth 2.0" : ssoProvider === "oidc" ? "OIDC" : "LDAP"}` : "未启用"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={ssoEnabled} onCheckedChange={(v) => { setSsoEnabled(v); setToast(v ? "SSO 已启用" : "SSO 已禁用"); }} />
                      <Button variant="outline" size="sm" onClick={handleConfigSSO}>
                        <Settings className="size-3 mr-1" /> 配置
                      </Button>
                    </div>
                  </div>
                  {ssoEnabled && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Provider:</span> {ssoProvider === "saml" ? "SAML 2.0" : ssoProvider === "oauth" ? "OAuth 2.0" : ssoProvider === "oidc" ? "OIDC" : "LDAP"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">状态:</span> <Badge variant="default" className="text-[10px]">已连接</Badge>
                      </div>
                    </div>
                  )}
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
            <div className="space-y-2">
              <Label>订阅事件</Label>
              <div className="flex flex-wrap gap-2">
                {["instance.created", "instance.updated", "instance.deleted", "process.started", "process.completed", "process.failed"].map((ev) => (
                  <label key={ev} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWebhookEvents.includes(ev)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewWebhookEvents((prev) => [...prev, ev]);
                        } else {
                          setNewWebhookEvents((prev) => prev.filter((x) => x !== ev));
                        }
                      }}
                      className="rounded"
                    />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddWebhook}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SSO 配置对话框 ── */}
      <Dialog open={ssoDialogOpen} onOpenChange={setSsoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" /> SSO 配置
            </DialogTitle>
            <DialogDescription>配置单点登录 (SSO) 以集成企业身份认证系统</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div>
                <div className="font-medium text-sm">启用 SSO</div>
                <div className="text-xs text-muted-foreground">开启后用户可通过 SSO 登录</div>
              </div>
              <Switch checked={ssoEnabled} onCheckedChange={setSsoEnabled} />
            </div>

            {/* Provider select */}
            <div className="space-y-2">
              <Label>SSO Provider</Label>
              <Select value={ssoProvider} onValueChange={setSsoProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="选择 SSO 提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saml">SAML 2.0</SelectItem>
                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                  <SelectItem value="oidc">OIDC (OpenID Connect)</SelectItem>
                  <SelectItem value="ldap">LDAP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic form based on provider */}
            {ssoProvider === "saml" && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="font-medium text-sm flex items-center gap-2">
                  <Shield className="size-4" /> SAML 2.0 配置
                </div>
                <div className="space-y-2">
                  <Label>Entity ID</Label>
                  <Input value={ssoConfig.entityId} onChange={(e) => handleUpdateSsoField("entityId", e.target.value)} placeholder="https://idp.example.com/entity-id" />
                </div>
                <div className="space-y-2">
                  <Label>SSO URL</Label>
                  <Input value={ssoConfig.ssoUrl} onChange={(e) => handleUpdateSsoField("ssoUrl", e.target.value)} placeholder="https://idp.example.com/sso/saml" />
                </div>
                <div className="space-y-2">
                  <Label>X.509 证书</Label>
                  <Textarea value={ssoConfig.certificate} onChange={(e) => handleUpdateSsoField("certificate", e.target.value)} placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----" className="font-mono text-xs h-28" />
                </div>
                <div className="space-y-2">
                  <Label>属性映射 (JSON)</Label>
                  <Textarea value={ssoConfig.attributeMapping} onChange={(e) => handleUpdateSsoField("attributeMapping", e.target.value)} placeholder='{"email":"email","name":"displayName"}' className="font-mono text-xs h-20" />
                </div>
              </div>
            )}

            {(ssoProvider === "oauth" || ssoProvider === "oidc") && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="font-medium text-sm flex items-center gap-2">
                  <Key className="size-4" /> {ssoProvider === "oidc" ? "OIDC" : "OAuth 2.0"} 配置
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input value={ssoConfig.clientId} onChange={(e) => handleUpdateSsoField("clientId", e.target.value)} placeholder="your-client-id" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input type="password" value={ssoConfig.clientSecret} onChange={(e) => handleUpdateSsoField("clientSecret", e.target.value)} placeholder="your-client-secret" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Authorization URL</Label>
                  <Input value={ssoConfig.authorizationUrl} onChange={(e) => handleUpdateSsoField("authorizationUrl", e.target.value)} placeholder="https://idp.example.com/oauth/authorize" />
                </div>
                <div className="space-y-2">
                  <Label>Token URL</Label>
                  <Input value={ssoConfig.tokenUrl} onChange={(e) => handleUpdateSsoField("tokenUrl", e.target.value)} placeholder="https://idp.example.com/oauth/token" />
                </div>
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Input value={ssoConfig.scope} onChange={(e) => handleUpdateSsoField("scope", e.target.value)} placeholder="openid profile email" />
                </div>
              </div>
            )}

            {ssoProvider === "ldap" && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="font-medium text-sm flex items-center gap-2">
                  <Server className="size-4" /> LDAP 配置
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>Host</Label>
                    <Input value={ssoConfig.ldapHost} onChange={(e) => handleUpdateSsoField("ldapHost", e.target.value)} placeholder="ldap.example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input value={ssoConfig.ldapPort} onChange={(e) => handleUpdateSsoField("ldapPort", e.target.value)} placeholder="389" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Base DN</Label>
                  <Input value={ssoConfig.baseDn} onChange={(e) => handleUpdateSsoField("baseDn", e.target.value)} placeholder="dc=example,dc=com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Bind DN</Label>
                    <Input value={ssoConfig.bindDn} onChange={(e) => handleUpdateSsoField("bindDn", e.target.value)} placeholder="cn=admin,dc=example,dc=com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bind Password</Label>
                    <Input type="password" value={ssoConfig.bindPassword} onChange={(e) => handleUpdateSsoField("bindPassword", e.target.value)} placeholder="******" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>User Filter</Label>
                  <Input value={ssoConfig.userFilter} onChange={(e) => handleUpdateSsoField("userFilter", e.target.value)} placeholder="(uid={0})" className="font-mono text-xs" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleTestSSO} disabled={testingSSO}>
              {testingSSO ? <Loader2 className="size-4 animate-spin mr-1" /> : <TestTube2 className="size-4 mr-1" />}
              测试连接
            </Button>
            <Button variant="outline" onClick={() => setSsoDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveSSO}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IM 集成配置对话框 ── */}
      <Dialog open={imDialogOpen} onOpenChange={setImDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="size-5" /> {imPlatform} 集成配置
            </DialogTitle>
            <DialogDescription>配置 {imPlatform} 平台的应用凭证和事件订阅</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* App credentials */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="font-medium text-sm">应用凭证</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>App ID</Label>
                  <Input value={imConfig.appId} onChange={(e) => handleUpdateIMField("appId", e.target.value)} placeholder="cli_xxxxxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label>App Secret</Label>
                  <Input type="password" value={imConfig.appSecret} onChange={(e) => handleUpdateIMField("appSecret", e.target.value)} placeholder="******" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input value={imConfig.webhookUrl} onChange={(e) => handleUpdateIMField("webhookUrl", e.target.value)} placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx" />
              </div>
            </div>

            {/* Bot config */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="font-medium text-sm">机器人配置</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>机器人名称</Label>
                  <Input value={imConfig.botName} onChange={(e) => handleUpdateIMField("botName", e.target.value)} placeholder="MetaPlatform Bot" />
                </div>
                <div className="space-y-2">
                  <Label>头像 URL</Label>
                  <Input value={imConfig.botAvatar} onChange={(e) => handleUpdateIMField("botAvatar", e.target.value)} placeholder="https://example.com/avatar.png" />
                </div>
              </div>
            </div>

            {/* Event subscriptions */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="font-medium text-sm">事件订阅</div>
              <div className="space-y-2">
                {[
                  { key: "msgEvent", label: "消息事件", desc: "接收和处理消息" },
                  { key: "taskEvent", label: "任务事件", desc: "任务创建/完成/变更通知" },
                  { key: "processEvent", label: "流程事件", desc: "流程启动/完成/异常通知" },
                ].map((ev) => (
                  <div key={ev.key} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">{ev.label}</div>
                      <div className="text-xs text-muted-foreground">{ev.desc}</div>
                    </div>
                    <Switch
                      checked={imConfig[ev.key as keyof typeof imConfig] as boolean}
                      onCheckedChange={(v) => handleUpdateIMField(ev.key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Notification rules */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="font-medium text-sm">通知规则</div>
              <div className="text-xs text-muted-foreground mb-2">选择哪些事件触发 {imPlatform} 通知</div>
              <div className="flex flex-wrap gap-2">
                {["流程完成", "审批提醒", "任务分配", "流程异常", "SLA 超时", "系统告警"].map((rule) => {
                  const active = (imNotifyRules[imPlatform] || []).includes(rule);
                  return (
                    <label key={rule} className={`flex items-center gap-1.5 text-xs cursor-pointer px-2.5 py-1.5 rounded-md border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => handleToggleIMRule(imPlatform, rule)}
                        className="sr-only"
                      />
                      {active && <Check className="size-3" />}
                      {rule}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleSyncOrg} disabled={syncingOrg}>
              {syncingOrg ? <Loader2 className="size-4 animate-spin mr-1" /> : <Users className="size-4 mr-1" />}
              同步组织架构
            </Button>
            <Button variant="outline" onClick={handleTestIM} disabled={testingIM}>
              {testingIM ? <Loader2 className="size-4 animate-spin mr-1" /> : <Send className="size-4 mr-1" />}
              测试发送
            </Button>
            <Button variant="outline" onClick={() => setImDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveIM}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
