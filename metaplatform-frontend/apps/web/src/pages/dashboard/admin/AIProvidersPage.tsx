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
  Modal,
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
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { AdminSystemConfig } from "@/types";
import { listConfigs, updateConfig, batchCreateConfigs } from "@/api/admin/configs";
import { listAiModels, saveAiModelsBulk, updateAiModel, deleteAiModel, type AiModelItem } from "@/api/admin/models";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";
import { formatDateTime } from "@/utils/datetime";
import { useSettings } from "@/contexts/SettingsContext";
import { testProvider, fetchProviderModels } from "@mate/shared/api";

type ProviderId = string;

const BUILTIN_PROVIDERS = ["openai", "azure", "ollama"];

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

// 自定义 provider 的 metadata fallback（动态 instanceId 用）
const customLabels: Record<string, string> = {};

function getProviderMeta(id: string) {
  if (PROVIDER_META[id as keyof typeof PROVIDER_META]) {
    return PROVIDER_META[id as keyof typeof PROVIDER_META];
  }
  // custom_{instanceId} → 从 config label 生成
  const label = customLabels[id] || id.replace(/^custom_/, "");
  return {
    name: label,
    description: "自定义 OpenAI 兼容 API",
    docs: "",
    icon: <MessageOutlined />,
    color: "#f59e0b",
    baseUrlExample: "https://api.example.com/v1",
    defaultModelExample: "model-name",
  };
}

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
  const [customProviderIds, setCustomProviderIds] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const [adding, setAdding] = useState(false);
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
  const [models, setModels] = useState<Record<ProviderId, AiModelItem[]>>({
    openai: [],
    azure: [],
    ollama: [],
    custom: [],
  });
  const [fetchingModels, setFetchingModels] = useState<Record<ProviderId, boolean>>({
    openai: false,
    azure: false,
    ollama: false,
    custom: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await listConfigs({ pageSize: 200 });
      const aiItems = (res.items ?? []).filter((c) => c.category === "AI_PROVIDER");
      setItems(aiItems);
      const active = aiItems.find((c) => c.key === "ai.provider.default_active");
      if (active && typeof active.value === "string") setDefaultActive(active.value);
      // 发现自定义 provider：从 config key 前缀 ai.provider.custom_* 提取
      const customs = new Set<string>();
      for (const c of aiItems) {
        const m = c.key.match(/^ai\.provider\.(custom_\w+)\./);
        if (m) {
          customs.add(m[1]);
          // 从 label 或 key 提取显示名
          const labelCfg = aiItems.find((x) => x.key === `ai.provider.${m[1]}.label`);
          customLabels[m[1]] = (labelCfg?.value as string) || m[1].replace(/^custom_/, "");
        }
      }
      // 也保留旧版单一 custom（向后兼容）
      if (aiItems.some((c) => c.key.startsWith("ai.provider.custom."))) {
        customs.add("custom");
        customLabels["custom"] = "自定义第三方";
      }
      setCustomProviderIds([...customs].sort());
    } catch {
      // 静默降级：保留空卡片 UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 添加自定义 Provider
  const handleAddCustom = async () => {
    const name = newProviderName.trim();
    if (!name) {
      message.warning("请输入名称");
      return;
    }
    const instanceId = "custom_" + name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 20);
    if (customProviderIds.includes(instanceId)) {
      message.warning("该 Provider 已存在");
      return;
    }
    setAdding(true);
    try {
      await batchCreateConfigs([
        { key: `ai.provider.${instanceId}.enabled`, value: "true", value_type: "bool", label: `${name} 启用` },
        { key: `ai.provider.${instanceId}.base_url`, value: "", value_type: "string", label: `${name} Base URL` },
        { key: `ai.provider.${instanceId}.api_key`, value: "", value_type: "string", label: `${name} API Key`, is_sensitive: true },
        { key: `ai.provider.${instanceId}.default_model`, value: "", value_type: "string", label: `${name} 默认模型` },
        { key: `ai.provider.${instanceId}.label`, value: name, value_type: "string", label: `${name} 显示名` },
      ]);
      message.success(`已添加 ${name}`);
      setAddModalOpen(false);
      setNewProviderName("");
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "添加失败");
    } finally {
      setAdding(false);
    }
  };

  // provider ID → LLMGW provider type（自定义都映射为 custom）
  const llmgwProvider = (id: string) => id.startsWith("custom") ? "custom" : id;

  // 加载已配置的模型清单
  useEffect(() => {
    (async () => {
      try {
        const all = await listAiModels();
        const grouped: Record<ProviderId, AiModelItem[]> = {
          openai: [],
          azure: [],
          ollama: [],
          custom: [],
        };
        for (const m of all) {
          const p = m.provider as ProviderId;
          if (grouped[p]) grouped[p].push(m);
        }
        setModels(grouped);
      } catch {
        // 静默：模型清单不可用时保留空
      }
    })();
  }, []);

  // 「获取模型」：调 LLMGW providers/models 拉上游模型 → 批量存 IAM
  const handleFetchModels = async (provider: ProviderId) => {
    const cfg = pickByKey(provider, "base_url");
    const baseUrl = cfg && typeof cfg.value === "string" ? cfg.value : "";
    if (!baseUrl) {
      message.warning("请先填写 Base URL");
      return;
    }
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
    setFetchingModels((s) => ({ ...s, [provider]: true }));
    try {
      const result = await fetchProviderModels({
        provider,
        base_url: baseUrl,
        api_key: apiKeyValue,
        api_version: apiVersion,
        timeout_sec: 15,
      });
      if (!result.ok || result.models.length === 0) {
        message.warning(result.message || "未获取到模型");
        return;
      }
      await saveAiModelsBulk(
        llmgwProvider(provider),
        result.models.map((mid) => ({
          modelId: mid,
          displayName: result.display_names?.[mid] || undefined,
          modality: provider === "azure" || provider === "ollama" ? "text" : "text",
          enabled: true,
        })),
      );
      message.success(`已获取 ${result.models.length} 个模型并保存`);
      const refreshed = await listAiModels({ provider });
      setModels((s) => ({ ...s, [provider]: refreshed }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : "获取模型失败");
    } finally {
      setFetchingModels((s) => ({ ...s, [provider]: false }));
    }
  };

  const handleToggleModel = async (model: AiModelItem) => {
    if (model.id == null) return;
    try {
      await updateAiModel(model.id, { enabled: !model.enabled });
      const provider = model.provider as ProviderId;
      const refreshed = await listAiModels({ provider });
      setModels((s) => ({ ...s, [provider]: refreshed }));
    } catch {
      message.error("更新失败");
    }
  };

  const handleDeleteModel = async (model: AiModelItem) => {
    if (model.id == null) return;
    try {
      await deleteAiModel(model.id);
      const provider = model.provider as ProviderId;
      setModels((s) => ({
        ...s,
        [provider]: s[provider].filter((m) => m.id !== model.id),
      }));
      message.success("已删除模型");
    } catch {
      message.error("删除失败");
    }
  };

  const pickByKey = (provider: ProviderId, suffix: string): AdminSystemConfig | undefined =>
    items.find((c) => c.key === `ai.provider.${provider}.${suffix}`);

  const providerSummary = useMemo(() => {
    const list: ProviderId[] = [...BUILTIN_PROVIDERS, ...customProviderIds];
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
        // 从 DOM 读最新值：antd Input / Input.Password 渲染为 <input>
        const el = document.querySelector(`[data-cfg-key="${cfg.key}"]`) as HTMLInputElement | null;
        if (!el) continue;
        const raw = el.value;
        if (raw === undefined || raw === "") {
          // 空值：API Key 等敏感字段可能保留原值（不改空）
          if (s === "api_key") continue;
        }
        let payload: unknown = raw;
        if (cfg.valueType === "bool") payload = raw === "true" || raw === "on";
        if (cfg.valueType === "int") payload = parseInt(raw, 10);
        await updateConfig(cfg.key, payload, "AI Provider 配置调整");
      }
      message.success("已保存");
      await load();
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
      message.success((enabled ? "已启用 " : "已禁用 ") + getProviderMeta(provider).name);
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
        provider: llmgwProvider(provider) as any,
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
    const meta = getProviderMeta(id);
    const enabled = pickByKey(id, "enabled");
    const baseUrl = pickByKey(id, "base_url");
    const apiKey = pickByKey(id, "api_key");
    const defaultModel = pickByKey(id, "default_model");
    const apiVersion = id === "azure" ? pickByKey(id, "api_version") : undefined;
    const isEnabled = enabled?.value === true || enabled?.value === "true";
    // testStates 只初始化了 4 个内置 key；动态添加的自定义 provider 不在其中，
    // 直接读 testStates[id] 会得到 undefined → testState.status 崩溃（页面白屏）。
    const testState = testStates[id] ?? { status: "idle" as const };
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
              icon={<CloudDownloadOutlined />}
              onClick={() => handleFetchModels(id)}
              loading={fetchingModels[id]}
              disabled={!isEnabled}
            >
              获取模型
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

        {/* 已配置模型清单 */}
        {(models[id]?.length ?? 0) > 0 && (
          <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--muted-foreground)" }}>
              已配置模型（{models[id].length}）
            </div>
            <Space wrap size={[4, 4]}>
              {models[id].map((m) => (
                <Tag
                  key={m.id}
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    handleDeleteModel(m);
                  }}
                  icon={
                    <Switch
                      size="small"
                      checked={m.enabled}
                      onChange={() => handleToggleModel(m)}
                      style={{ marginRight: 4 }}
                    />
                  }
                  style={{ display: "inline-flex", alignItems: "center", cursor: "default" }}
                >
                  {m.displayName || m.modelId}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>
    );
  };

  return (
    <AdminLayout
      title="AI 提供方"
      extra={
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            添加自定义 Provider
          </Button>
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
                  ...BUILTIN_PROVIDERS.map((id) => ({ value: id, label: `${PROVIDER_META[id as keyof typeof PROVIDER_META].name}（内置）` })),
                  ...customProviderIds.map((id) => ({ value: id, label: getProviderMeta(id).name })),
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
          {([...BUILTIN_PROVIDERS, ...customProviderIds] as ProviderId[]).map(renderProviderCard)}
        </div>
      </Spin>

      <p style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 16 }}>
        最后更新：{formatDateTime(items[0]?.updatedAt ?? "", settings)}
      </p>

      <Modal
        title="添加自定义 Provider"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={handleAddCustom}
        confirmLoading={adding}
        okText="添加"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item
            label="Provider 名称"
            help="输入显示名称（如「智谱 GLM」「DeepSeek」「公司自建」），系统自动生成 instanceId"
            required
          >
            <Input
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              placeholder="例如：智谱 GLM"
              maxLength={20}
              onPressEnter={handleAddCustom}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
