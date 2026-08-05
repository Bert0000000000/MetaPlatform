/**
 * AI Provider 管理页 — 系统配置 AI_PROVIDER 分类的可视化与连接测试
 * - 卡片视图：OpenAI / Azure OpenAI / Ollama / 自定义第三方
 * - 顶部：默认生效的 provider 切换
 * - 每个卡片：启用 / Base URL / API Key / 默认模型 + [保存] [测试连接]
 */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  GlobalOutlined,
  KeyOutlined,
  LoadingOutlined,
  MessageOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { AdminSystemConfig } from "@/types";
import { listConfigs, updateConfig } from "@/api/admin/configs";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";
import { formatDateTime } from "@/utils/datetime";
import { useSettings } from "@/contexts/SettingsContext";
import { testProvider } from "@mate/shared/api";

type ProviderId = "openai" | "azure" | "ollama" | "custom";

const PROVIDER_META: Record<
  ProviderId,
  {
    name: string;
    description: string;
    docs: string;
    icon: React.ReactNode;
    color: string;
    baseUrlExample: string;
    defaultModelExample: string;
  }
> = {
  openai: {
    name: "OpenAI",
    description: "OpenAI 官方或自建 OpenAI 兼容代理",
    docs: "https://platform.openai.com/docs/api-reference",
    icon: <GlobalOutlined />,
    color: "#10a37f",
    baseUrlExample: "https://api.openai.com/v1",
    defaultModelExample: "gpt-4o-mini",
  },
  azure: {
    name: "Azure OpenAI",
    description: "Azure 上的 OpenAI 服务，需部署 Deployment",
    docs: "https://learn.microsoft.com/azure/ai-services/openai/",
    icon: <CloudServerOutlined />,
    color: "#0078d4",
    baseUrlExample: "https://{your-resource}.openai.azure.com/openai/deployments",
    defaultModelExample: "gpt-4o",
  },
  ollama: {
    name: "Ollama（本地）",
    description: "本地/自托管开源模型（无需 API Key）",
    docs: "https://ollama.com/",
    icon: <KeyOutlined />,
    color: "#7c3aed",
    baseUrlExample: "http://localhost:11434",
    defaultModelExample: "llama3.2",
  },
  custom: {
    name: "自定义第三方",
    description: "任何 OpenAI 兼容 API（智谱 GLM、DeepSeek、自建网关等）",
    docs: "",
    icon: <MessageOutlined />,
    color: "#f59e0b",
    baseUrlExample: "https://open.bigmodel.cn/api/paas/v4",
    defaultModelExample: "glm-4-flash",
  },
};

interface TestState {
  status: "idle" | "loading" | "ok" | "fail";
  message?: string;
  latencyMs?: number;
}

export default function AIProvidersPage() {
  const { settings } = useSettings();
  const { message } = App.useApp();
  const [items, setItems] = useState<AdminSystemConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultActive, setDefaultActive] = useState<string>("openai");
  const [testStates, setTestStates] = useState<Record<ProviderId, TestState>>({
    openai: { status: "idle" },
    azure: { status: "idle" },
    ollama: { status: "idle" },
    custom: { status: "idle" },
  });
  const [saving, setSaving] = useState<Record<ProviderId, boolean>>({
    openai: false,
    azure: false,
    ollama: false,
    custom: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      // 不传 category：兼容尚未重启的旧后端（无 AI_PROVIDER enum 时 422）
      const res = await listConfigs({ pageSize: 200 });
      const aiItems = (res.items ?? []).filter((c) => c.category === "AI_PROVIDER");
      setItems(aiItems);
      const active = aiItems.find((c) => c.key === "ai.provider.default_active");
      if (active && typeof active.value === "string") setDefaultActive(active.value);
    } catch {
      // 静默降级：保留空卡片 UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pickByKey = (provider: ProviderId, suffix: string): AdminSystemConfig | undefined =>
    items.find((c) => c.key === `ai.provider.${provider}.${suffix}`);

  const providerSummary = useMemo(() => {
    const list: ProviderId[] = ["openai", "azure", "ollama", "custom"];
    const enabledCount = list.filter((id) => pickByKey(id, "enabled")?.value === "true").length;
    const configured = list.filter((id) => {
      const base = pickByKey(id, "base_url");
      return base && typeof base.value === "string" && base.value.length > 0;
    }).length;
    return { enabledCount, configured, total: list.length };
  }, [items]);

  const handleSave = async (provider: ProviderId) => {
    setSaving((s) => ({ ...s, [provider]: true }));
    try {
      const suffixes = ["enabled", "base_url", "api_key", "default_model", "api_version"];
      for (const s of suffixes) {
        const cfg = pickByKey(provider, s);
        if (!cfg) continue;
        const raw = (document.querySelector(`[data-cfg-key="${cfg.key}"]`) as HTMLInputElement | null)?.value;
        if (raw === undefined) continue;
        let payload: unknown = raw;
        if (cfg.valueType === "bool") payload = raw === "true" || raw === "on";
        if (cfg.valueType === "int") payload = parseInt(raw, 10);
        await updateConfig(cfg.key, payload, "AI Provider 配置调整");
      }
      message.success("已保存");
      load();
    } catch {
      /* ignore */
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  };

  const setField = async (provider: ProviderId, suffix: string, value: unknown, valueType: string) => {
    const cfg = pickByKey(provider, suffix);
    if (!cfg) return;
    await updateConfig(cfg.key, value, `AI Provider ${provider}.${suffix}`);
  };

  const handleToggle = async (provider: ProviderId, enabled: boolean) => {
    try {
      await setField(provider, "enabled", enabled, "bool");
      message.success((enabled ? "已启用 " : "已禁用 ") + PROVIDER_META[provider].name);
      load();
    } catch {
      /* ignore */
    }
  };

  const handleDefaultChange = async (val: string) => {
    setDefaultActive(val);
    try {
      await updateConfig("ai.provider.default_active", val, "切换默认 AI Provider");
      message.success("默认 Provider 已切换");
      load();
    } catch {
      /* ignore */
    }
  };

  // 简易"连接测试"：通过后端代理（LLMGW POST /api/v1/llmgw/providers/test，
  // ADR-0019）发到上游 LLM 平台。浏览器不再直接 fetch 第三方 API
  // （避免 CORS + API Key 暴露）。
  const handleTest = async (provider: ProviderId) => {
    const cfg = pickByKey(provider, "base_url");
    const baseUrl = cfg && typeof cfg.value === "string" ? cfg.value : "";
    if (!baseUrl) {
      message.warning("请先填写 Base URL");
      return;
    }
    setTestStates((s) => ({ ...s, [provider]: { status: "loading" } }));
    const apiKeyCfg = pickByKey(provider, "api_key");
    const apiKeyValue =
      apiKeyCfg && typeof apiKeyCfg.value === "string" && apiKeyCfg.value.length > 0
        ? apiKeyCfg.value
        : null;
    const apiVersion = (() => {
      if (provider !== "azure") return undefined;
      const v = pickByKey(provider, "api_version");
      return v && typeof v.value === "string" ? v.value : undefined;
    })();
    try {
      const result = await testProvider({
        provider,
        base_url: baseUrl,
        api_key: apiKeyValue,
        api_version: apiVersion,
        timeout_sec: 10,
      });
      setTestStates((s) => ({
        ...s,
        [provider]: {
          status: result.ok ? "ok" : "fail",
          message: result.message,
          latencyMs: result.latency_ms,
        },
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestStates((s) => ({
        ...s,
        [provider]: { status: "fail", message: msg, latencyMs: 0 },
      }));
    }
  };

  const renderValue = (cfg: AdminSystemConfig | undefined, provider: ProviderId, fallback: string) => {
    if (!cfg) return fallback;
    if (cfg.isSensitive) return "********";
    const v = cfg.value;
    if (cfg.valueType === "bool") return v ? "true" : "false";
    return typeof v === "string" ? v : fallback;
  };

  const renderProviderCard = (id: ProviderId) => {
    const meta = PROVIDER_META[id];
    const enabled = pickByKey(id, "enabled");
    const baseUrl = pickByKey(id, "base_url");
    const apiKey = pickByKey(id, "api_key");
    const defaultModel = pickByKey(id, "default_model");
    const apiVersion = id === "azure" ? pickByKey(id, "api_version") : undefined;
    const isEnabled = enabled?.value === true || enabled?.value === "true";
    const testState = testStates[id];
    const isSaving = saving[id];

    return (
      <Card
        key={id}
        title={
          <Space>
            <span style={{ color: meta.color, fontSize: 18 }}>{meta.icon}</span>
            <strong>{meta.name}</strong>
            {isEnabled ? <Tag color="success">已启用</Tag> : <Tag>未启用</Tag>}
            {defaultActive === id && <Tag color="processing">默认</Tag>}
          </Space>
        }
        extra={
          <Switch
            checked={isEnabled}
            onChange={(v) => handleToggle(id, v)}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        }
        style={{ borderRadius: 8 }}
      >
        <p style={{ color: "var(--muted-foreground)", marginTop: 0 }}>{meta.description}</p>
        <Form layout="vertical">
          <Form.Item
            label={
              <Space>
                <span>Base URL</span>
                <Tooltip title={`示例：${meta.baseUrlExample}`}>
                  <Tag style={{ marginLeft: 0 }}>示例</Tag>
                </Tooltip>
              </Space>
            }
          >
            <Input
              data-cfg-key={baseUrl?.key}
              defaultValue={renderValue(baseUrl, id, meta.baseUrlExample)}
              placeholder={meta.baseUrlExample}
              disabled={!isEnabled}
            />
          </Form.Item>
          <Form.Item label="API Key">
            <Input.Password
              data-cfg-key={apiKey?.key}
              defaultValue={(apiKey?.value as string) ?? ""}
              placeholder={apiKey?.value ? "已设置（输入新值覆盖）" : "输入 API Key"}
              disabled={!isEnabled}
            />
          </Form.Item>
          <Form.Item label="默认模型">
            <Input
              data-cfg-key={defaultModel?.key}
              defaultValue={renderValue(defaultModel, id, meta.defaultModelExample)}
              placeholder={meta.defaultModelExample}
              disabled={!isEnabled}
            />
          </Form.Item>
          {apiVersion && (
            <Form.Item label="API Version">
              <Input
                data-cfg-key={apiVersion.key}
                defaultValue={renderValue(apiVersion, id, "2024-02-01")}
                placeholder="2024-02-01"
                disabled={!isEnabled}
              />
            </Form.Item>
          )}
        </Form>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <Space>
            {testState.status === "idle" && (
              <Tag icon={<ThunderboltOutlined />}>未测试</Tag>
            )}
            {testState.status === "loading" && (
              <Tag icon={<LoadingOutlined />} color="processing">
                测试中…
              </Tag>
            )}
            {testState.status === "ok" && (
              <Tag icon={<CheckCircleOutlined />} color="success">
                {testState.message}
                {testState.latencyMs ? " · " + testState.latencyMs + "ms" : ""}
              </Tag>
            )}
            {testState.status === "fail" && (
              <Tag icon={<CloseCircleOutlined />} color="error">
                {testState.message}
              </Tag>
            )}
          </Space>
          <Space>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => handleTest(id)}
              disabled={!isEnabled || testState.status === "loading"}
            >
              测试连接
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSave(id)}
              loading={isSaving}
              disabled={!isEnabled}
            >
              保存
            </Button>
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <AdminLayout
      title="AI 提供方"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
        </Space>
      }
    >
      <StatGrid>
        <StatCard label="已启用" value={providerSummary.enabledCount} color="success" />
        <StatCard label="已配置 Base URL" value={providerSummary.configured} color="warning" />
        <StatCard label="Provider 数量" value={providerSummary.total} />
        <StatCard
          label="默认生效"
          value={PROVIDER_META[defaultActive as ProviderId]?.name ?? defaultActive}
          color="default"
        />
      </StatGrid>

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        title="AI Provider 配置对接到外部第三方模型服务"
        description={
          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
            <span>
              下游 AI 助手 / Agent / 知识库检索会按"默认生效"选择实际调用的 provider。修改后请使用「测试连接」验证连通性。
            </span>
            <span>
              默认 Provider：
              <Select
                size="small"
                value={defaultActive}
                onChange={handleDefaultChange}
                style={{ marginLeft: 8, minWidth: 200 }}
                options={[
                  { value: "openai", label: "OpenAI (默认)" },
                  { value: "azure", label: "Azure OpenAI" },
                  { value: "ollama", label: "Ollama（本地）" },
                  { value: "custom", label: "自定义 OpenAI 兼容" },
                  { value: "disabled", label: "禁用（临时下线）" },
                ]}
              />
            </span>
          </Space>
        }
      />

      <Spin spinning={loading}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 16,
          }}
        >
          {(["openai", "azure", "ollama", "custom"] as ProviderId[]).map(renderProviderCard)}
        </div>
      </Spin>

      <p style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 16 }}>
        最后更新：{formatDateTime(items[0]?.updatedAt ?? "", settings)}
      </p>
    </AdminLayout>
  );
}
