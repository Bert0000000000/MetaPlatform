/**
 * AI Provider 管理页（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 抽屉）。
 * 数据面沿用 src/api/admin/configs + src/api/admin/models，未新增后端契约：
 * - 表格：每个 provider 一行（启用状态 / Base URL / 默认模型 / 模型数 / 连接测试）
 * - 抽屉：编辑单 provider 的 Base URL / API Key / 默认模型 / Embedding 模型 / API Version
 * - 抽屉：查看并管理该 provider 已获取的模型清单（启用开关 / 删除）
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Toast,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  CheckCircle2,
  CloudDownload,
  Globe,
  KeyRound,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import type { AdminSystemConfig } from '@/types';
import { batchCreateConfigs, listConfigs, updateConfig } from '@/api/admin/configs';
import {
  deleteAiModel,
  listAiModels,
  saveAiModelsBulk,
  updateAiModel,
  type AiModelItem,
} from '@/api/admin/models';
import { fetchProviderModels, testProvider } from '@mate/shared/api';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import { formatDateTime } from '@/utils/datetime';
import { useSettings } from '@/contexts/SettingsContext';
import './admin.css';

type ProviderId = string;

const BUILTIN_PROVIDERS = ['openai', 'azure', 'ollama', 'ark'];

interface ProviderMeta {
  name: string;
  description: string;
  docs: string;
  icon: React.ReactNode;
  baseUrlExample: string;
  defaultModelExample: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  openai: {
    name: 'OpenAI',
    description: 'OpenAI 官方或自建 OpenAI 兼容代理',
    docs: 'https://platform.openai.com/docs/api-reference',
    icon: <Globe size={16} strokeWidth={1.5} />,
    baseUrlExample: 'https://api.openai.com/v1',
    defaultModelExample: 'gpt-4o-mini',
  },
  azure: {
    name: 'Azure OpenAI',
    description: 'Azure 上的 OpenAI 服务，需部署 Deployment',
    docs: 'https://learn.microsoft.com/azure/ai-services/openai/',
    icon: <Server size={16} strokeWidth={1.5} />,
    baseUrlExample: 'https://{your-resource}.openai.azure.com/openai/deployments',
    defaultModelExample: 'gpt-4o',
  },
  ollama: {
    name: 'Ollama（本地）',
    description: '本地 / 自托管开源模型（无需 API Key）',
    docs: 'https://ollama.com/',
    icon: <KeyRound size={16} strokeWidth={1.5} />,
    baseUrlExample: 'http://localhost:11434',
    defaultModelExample: 'llama3.2',
  },
  ark: {
    name: '火山方舟 ARK',
    description: 'ARK Plan 专属通道（OpenAI 兼容，生产 Key 正式托管位）',
    docs: 'https://www.volcengine.com/product/ark',
    icon: <Zap size={16} strokeWidth={1.5} />,
    baseUrlExample: 'https://ark.cn-beijing.volces.com/api/plan/v3',
    defaultModelExample: 'glm-5.3-flash',
  },
};

// 自定义 provider 的显示名缓存（动态 instanceId 用）
const customLabels: Record<string, string> = {};

/** 只用到 getValues：用最小结构类型承接 Semi 的 formApi，避免深路径 import 与泛型噪声。 */
interface FormApiLike {
  getValues: () => Record<string, unknown>;
}

function getProviderMeta(id: string): ProviderMeta {
  const builtin = PROVIDER_META[id];
  if (builtin) return builtin;
  // custom_{instanceId} → 从 config label 生成
  const label = customLabels[id] || id.replace(/^custom_/, '');
  return {
    name: label,
    description: '自定义 OpenAI 兼容 API',
    docs: '',
    icon: <MessageSquare size={16} strokeWidth={1.5} />,
    baseUrlExample: 'https://api.example.com/v1',
    defaultModelExample: 'model-name',
  };
}

/**
 * 托管模式下的 API key 下发规则（ADR-0019）：
 * IAM 敏感配置读接口只返回掩码（***），真实 key 永不出后端 ——
 * 掩码或空值都转 null，由 llmgw 服务端从 IAM 解析。
 */
function maskedAwareKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const v = value.trim();
  return v === '***' || v === '********' ? null : value;
}

interface ReadFailure {
  forbidden: boolean;
  message: string;
}

function readFailure(error: unknown): ReadFailure {
  const failure = error as { status?: number; response?: { status?: number; data?: {
    code?: string; message?: string; detail?: string | { code?: string; message?: string };
  } } } | null;
  const response = failure?.response;
  const data = response?.data;
  const detail = typeof data?.detail === 'object' ? data.detail : undefined;
  return {
    forbidden: failure?.status === 403 || response?.status === 403
      || data?.code === 'E403_FORBIDDEN' || detail?.code === 'E403_FORBIDDEN',
    message: detail?.message || data?.message || (typeof data?.detail === 'string' ? data.detail : '')
      || (error instanceof Error ? error.message : String(error)),
  };
}

interface TestState {
  status: 'idle' | 'loading' | 'ok' | 'fail';
  message?: string;
  latencyMs?: number;
}

interface ProviderRow {
  id: string;
  name: string;
  kind: 'builtin' | 'custom';
  enabled: boolean;
  baseUrl: string;
  defaultModel: string;
  modelCount: number | null;
  isDefault: boolean;
}

export default function AIProvidersPage() {
  const { settings } = useSettings();
  const defaultLabelId = useId();

  const [items, setItems] = useState<AdminSystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure | null>(null);
  const [keyword, setKeyword] = useState('');

  const [defaultActive, setDefaultActive] = useState<string>();
  const [defaultEmbedding, setDefaultEmbedding] = useState<string>();
  const [customProviderIds, setCustomProviderIds] = useState<string[]>([]);

  const [models, setModels] = useState<Record<ProviderId, AiModelItem[]>>({});
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<ReadFailure | null>(null);
  const [testStates, setTestStates] = useState<Record<ProviderId, TestState>>({});
  const [fetchingId, setFetchingId] = useState<ProviderId | null>(null);
  const [savingId, setSavingId] = useState<ProviderId | null>(null);

  const [editId, setEditId] = useState<ProviderId | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const formApi = useRef<FormApiLike | null>(null);

  const loadModels = useCallback(async (provider?: ProviderId) => {
    setModelsLoading(true);
    try {
      const list = await listAiModels(provider ? { provider } : undefined);
      setModels((prev) => {
        const next: Record<ProviderId, AiModelItem[]> = provider ? { ...prev } : {};
        if (provider) {
          next[provider] = list;
        } else {
          for (const m of list) {
            next[m.provider] = next[m.provider] ?? [];
            next[m.provider].push(m);
          }
        }
        return next;
      });
      setModelsError(null);
    } catch (e) {
      setModelsError(readFailure(e));
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConfigs({ pageSize: 200 });
      setError(null);
      const aiItems = (res.items ?? []).filter((c) => c.category === 'AI_PROVIDER');
      setItems(aiItems);
      const active = aiItems.find((c) => c.key === 'ai.provider.default_active');
      setDefaultActive(typeof active?.value === 'string' ? active.value : undefined);
      const emb = aiItems.find((c) => c.key === 'ai.embedding.default_provider');
      setDefaultEmbedding(typeof emb?.value === 'string' ? emb.value : undefined);

      // 发现自定义 provider：从 config key 前缀 ai.provider.custom_* 提取
      const customs = new Set<string>();
      for (const c of aiItems) {
        const m = c.key.match(/^ai\.provider\.(custom_\w+)\./);
        if (m) {
          customs.add(m[1]);
          const labelCfg = aiItems.find((x) => x.key === `ai.provider.${m[1]}.label`);
          customLabels[m[1]] = (labelCfg?.value as string) || m[1].replace(/^custom_/, '');
        }
      }
      // 也保留旧版单一 custom（向后兼容）
      if (aiItems.some((c) => c.key.startsWith('ai.provider.custom.'))) {
        customs.add('custom');
        customLabels['custom'] = '自定义第三方';
      }
      setCustomProviderIds([...customs].sort());
    } catch (e) {
      setItems([]);
      setCustomProviderIds([]);
      setDefaultActive(undefined);
      setDefaultEmbedding(undefined);
      setError(readFailure(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadModels();
  }, [load, loadModels]);

  const configReady = !loading && !error;
  const modelsReady = !modelsLoading && !modelsError;

  const pickByKey = useCallback(
    (provider: ProviderId, suffix: string): AdminSystemConfig | undefined =>
      items.find((c) => c.key === `ai.provider.${provider}.${suffix}`),
    [items],
  );

  const providerIds = useMemo<ProviderId[]>(
    () => [...BUILTIN_PROVIDERS, ...customProviderIds],
    [customProviderIds],
  );

  const rows = useMemo<ProviderRow[]>(
    () =>
      providerIds.map((id) => {
        const enabledCfg = pickByKey(id, 'enabled');
        const baseUrlCfg = pickByKey(id, 'base_url');
        const modelCfg = pickByKey(id, 'default_model');
        return {
          id,
          name: getProviderMeta(id).name,
          kind: (BUILTIN_PROVIDERS as string[]).includes(id) ? 'builtin' : 'custom',
          enabled: enabledCfg?.value === true || enabledCfg?.value === 'true',
          baseUrl: typeof baseUrlCfg?.value === 'string' ? baseUrlCfg.value : '',
          defaultModel: typeof modelCfg?.value === 'string' ? modelCfg.value : '',
          modelCount: modelsReady ? (models[id] ?? []).length : null,
          isDefault: defaultActive === id,
        };
      }),
    [providerIds, pickByKey, models, modelsReady, defaultActive],
  );

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(kw) || r.id.toLowerCase().includes(kw),
    );
  }, [rows, keyword]);

  const summary = useMemo(() => {
    const enabledCount = rows.filter((r) => r.enabled).length;
    const configured = rows.filter((r) => r.baseUrl.length > 0).length;
    return { enabledCount, configured, total: rows.length };
  }, [rows]);

  // llmgw 探测/模型拉取的 provider 归一：custom_* 与 ark 都是 OpenAI 兼容透传
  const llmgwProvider = (id: string) => (id.startsWith('custom') || id === 'ark' ? 'custom' : id);

  const cfgString = (cfg?: AdminSystemConfig): string => {
    if (!cfg) return '';
    if (cfg.isSensitive) return '';
    const v = cfg.value;
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? v : String(v);
  };

  // ── 连接测试 ──
  const handleTest = async (provider: ProviderId) => {
    if (!configReady) return;
    const baseUrl = cfgString(pickByKey(provider, 'base_url'));
    if (!baseUrl) {
      Toast.warning('请先配置 Base URL');
      return;
    }
    setTestStates((s) => ({ ...s, [provider]: { status: 'loading' } }));
    const apiKeyValue = maskedAwareKey(pickByKey(provider, 'api_key')?.value);
    const apiVersion = (() => {
      if (provider !== 'azure') return undefined;
      const v = pickByKey(provider, 'api_version');
      return typeof v?.value === 'string' ? v.value : undefined;
    })();
    try {
      const result = await testProvider({
        provider: llmgwProvider(provider),
        base_url: baseUrl,
        api_key: apiKeyValue,
        api_version: apiVersion,
        timeout_sec: 10,
      });
      setTestStates((s) => ({
        ...s,
        [provider]: {
          status: result.ok ? 'ok' : 'fail',
          message: result.message,
          latencyMs: result.latency_ms,
        },
      }));
    } catch (e) {
      setTestStates((s) => ({
        ...s,
        [provider]: {
          status: 'fail',
          message: e instanceof Error ? e.message : String(e),
          latencyMs: 0,
        },
      }));
    }
  };

  // ── 获取模型：调 LLMGW providers/models 拉上游模型 → 批量存 IAM ──
  const handleFetchModels = async (provider: ProviderId) => {
    if (!configReady || !modelsReady) return;
    const baseUrl = cfgString(pickByKey(provider, 'base_url'));
    if (!baseUrl) {
      Toast.warning('请先配置 Base URL');
      return;
    }
    const apiKeyValue = maskedAwareKey(pickByKey(provider, 'api_key')?.value);
    const apiVersion = (() => {
      if (provider !== 'azure') return undefined;
      const v = pickByKey(provider, 'api_version');
      return typeof v?.value === 'string' ? v.value : undefined;
    })();
    setFetchingId(provider);
    try {
      const result = await fetchProviderModels({
        // 探测端点只认 openai/azure/ollama/custom；custom_* 与 ark 归一为 custom
        provider: llmgwProvider(provider),
        base_url: baseUrl,
        api_key: apiKeyValue,
        api_version: apiVersion,
        timeout_sec: 15,
      });
      if (!result.ok || result.models.length === 0) {
        Toast.warning(result.message || '未获取到模型');
        return;
      }
      await saveAiModelsBulk(
        // 模型桶按原始 provider id 存（ark / custom_* 各自独立）
        provider,
        result.models.map((mid) => ({
          modelId: mid,
          displayName: result.display_names?.[mid] || undefined,
          modality: 'text',
          enabled: true,
        })),
      );
      Toast.success(`已获取 ${result.models.length} 个模型并保存`);
      await loadModels(provider);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '获取模型失败');
    } finally {
      setFetchingId(null);
    }
  };

  const handleToggleModel = async (model: AiModelItem) => {
    if (!configReady || !modelsReady || model.id == null) return;
    try {
      await updateAiModel(model.id, { enabled: !model.enabled });
      await loadModels(model.provider);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  const handleDeleteModel = async (model: AiModelItem) => {
    if (!configReady || !modelsReady || model.id == null) return;
    try {
      await deleteAiModel(model.id);
      Toast.success('已删除模型');
      await loadModels(model.provider);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  // ── 启用 / 默认项切换 ──
  const handleToggle = async (provider: ProviderId, enabled: boolean) => {
    if (!configReady) return;
    const cfg = pickByKey(provider, 'enabled');
    if (!cfg) {
      Toast.warning('该 Provider 尚未初始化 enabled 配置');
      return;
    }
    try {
      await updateConfig(cfg.key, enabled, `AI Provider ${provider}.enabled`);
      Toast.success((enabled ? '已启用 ' : '已禁用 ') + getProviderMeta(provider).name);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const setDefaultActiveProvider = async (val: string) => {
    if (!configReady) return;
    setDefaultActive(val);
    try {
      await updateConfig('ai.provider.default_active', val, '切换默认 AI Provider');
      Toast.success('默认 Provider 已切换');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const setDefaultEmbeddingProvider = async (val: string) => {
    if (!configReady) return;
    setDefaultEmbedding(val);
    const key = 'ai.embedding.default_provider';
    try {
      await updateConfig(key, val, '切换默认 Embedding Provider');
    } catch {
      // Key 尚未 seed（旧后端）→ 幂等创建，值随创建写入
      try {
        await batchCreateConfigs([
          { key, value: val, value_type: 'string', label: '默认 Embedding Provider' },
        ]);
      } catch {
        Toast.error('默认 Embedding Provider 保存失败');
        return;
      }
    }
    Toast.success(val === 'disabled' ? 'Embedding 已禁用（回退本地）' : '默认 Embedding Provider 已切换');
    await load();
  };

  // ── 保存单 provider 配置 ──
  const submitProvider = async () => {
    if (!configReady) return;
    const provider = editId;
    const values = formApi.current?.getValues();
    if (!provider || !values) return;
    setSavingId(provider);
    try {
      const suffixes = ['enabled', 'base_url', 'api_key', 'default_model', 'embedding_model', 'api_version'];
      for (const s of suffixes) {
        const cfg = pickByKey(provider, s);
        if (!cfg) continue;
        const raw = values[s];
        // 敏感字段留空 = 保持原值（IAM 只回掩码，不覆盖）
        if (s === 'api_key' && (raw === undefined || raw === '')) continue;
        let payload: unknown = raw;
        if (cfg.valueType === 'bool') payload = raw === true || raw === 'true';
        else if (cfg.valueType === 'int') payload = parseInt(String(raw), 10);
        await updateConfig(cfg.key, payload, 'AI Provider 配置调整');
      }
      Toast.success('已保存');
      setEditId(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingId(null);
    }
  };

  // ── 添加自定义 Provider ──
  const submitCustom = async () => {
    if (!configReady) return;
    const name = newProviderName.trim();
    if (!name) {
      Toast.warning('请输入名称');
      return;
    }
    const instanceId =
      'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 20);
    if (customProviderIds.includes(instanceId)) {
      Toast.warning('该 Provider 已存在');
      return;
    }
    setAdding(true);
    try {
      await batchCreateConfigs([
        { key: `ai.provider.${instanceId}.enabled`, value: 'true', value_type: 'bool', label: `${name} 启用` },
        { key: `ai.provider.${instanceId}.base_url`, value: '', value_type: 'string', label: `${name} Base URL` },
        { key: `ai.provider.${instanceId}.api_key`, value: '', value_type: 'string', label: `${name} API Key`, is_sensitive: true },
        { key: `ai.provider.${instanceId}.default_model`, value: '', value_type: 'string', label: `${name} 默认模型` },
        { key: `ai.provider.${instanceId}.embedding_model`, value: '', value_type: 'string', label: `${name} Embedding 模型` },
        { key: `ai.provider.${instanceId}.label`, value: name, value_type: 'string', label: `${name} 显示名` },
      ]);
      Toast.success(`已添加 ${name}`);
      setAddOpen(false);
      setNewProviderName('');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const defaultOptions = useMemo(
    () => [
      ...BUILTIN_PROVIDERS.map((id) => ({
        value: id,
        label: `${getProviderMeta(id).name}（内置）`,
      })),
      ...customProviderIds.map((id) => ({ value: id, label: getProviderMeta(id).name })),
      { value: 'disabled', label: '禁用（临时下线）' },
    ],
    [customProviderIds],
  );

  const embeddingOptions = useMemo(
    () => [
      ...providerIds.map((id) => ({ value: id, label: getProviderMeta(id).name })),
      { value: 'disabled', label: '禁用（回退本地 hash）' },
    ],
    [providerIds],
  );

  const columns = useMemo(
    () => [
      {
        title: 'Provider',
        dataIndex: 'name',
        width: 220,
        render: (_: unknown, row: ProviderRow) => (
          <span className="mp-admin-cell">
            {getProviderMeta(row.id).icon}
            <span className="mp-admin-cell-main">
              <span className="mp-admin-cell-title">{row.name}</span>
              <span className="mp-admin-cell-sub">{getProviderMeta(row.id).description}</span>
            </span>
            {row.isDefault ? (
              <Tag size="small" color="blue" type="light">
                默认
              </Tag>
            ) : null}
            {row.kind === 'custom' ? <Tag size="small" type="light">自定义</Tag> : null}
          </span>
        ),
      },
      {
        title: '启用',
        dataIndex: 'enabled',
        width: 110,
        render: (_: unknown, row: ProviderRow) => (
          <Switch
            disabled={!configReady}
            checked={row.enabled}
            onChange={(v) => void handleToggle(row.id, v)}
            checkedText="ON"
            uncheckedText="OFF"
            aria-label={`启用 ${row.name}`}
          />
        ),
      },
      {
        title: 'Base URL',
        dataIndex: 'baseUrl',
        width: 280,
        ellipsis: true,
        render: (v: string) =>
          v ? <span className="mp-admin-mono">{v}</span> : <span className="mp-admin-faint">未配置</span>,
      },
      {
        title: '默认模型',
        dataIndex: 'defaultModel',
        width: 180,
        ellipsis: true,
        render: (v: string) =>
          v ? <span className="mp-admin-mono">{v}</span> : <span className="mp-admin-faint">—</span>,
      },
      {
        title: '模型数',
        dataIndex: 'modelCount',
        width: 90,
        render: (v: number | null) => (
          <Tag size="small" type="light" color={v !== null && v > 0 ? 'blue' : 'grey'}>
            {v ?? '未读取'}
          </Tag>
        ),
      },
      {
        title: '连接测试',
        dataIndex: '__test__',
        width: 200,
        render: (_: unknown, row: ProviderRow) => {
          const state = testStates[row.id] ?? { status: 'idle' as const };
          if (state.status === 'loading') {
            return (
              <Tag size="small" type="light" color="blue" prefixIcon={<Loader2 size={12} strokeWidth={1.5} />}>
                测试中…
              </Tag>
            );
          }
          if (state.status === 'ok') {
            return (
              <Tag size="small" type="light" color="green" prefixIcon={<CheckCircle2 size={12} strokeWidth={1.5} />}>
                {state.message}
                {state.latencyMs ? ` · ${state.latencyMs}ms` : ''}
              </Tag>
            );
          }
          if (state.status === 'fail') {
            return (
              <Tag size="small" type="light" color="red" prefixIcon={<XCircle size={12} strokeWidth={1.5} />}>
                {state.message}
              </Tag>
            );
          }
          return (
            <span className="mp-admin-faint">
              <Zap size={12} strokeWidth={1.5} /> 未测试
            </span>
          );
        },
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 320,
        render: (_: unknown, row: ProviderRow) => (
          <span className="mp-admin-row-actions">
            <Button
              theme="borderless"
              type="primary"
              size="small"
              disabled={!configReady}
              onClick={() => {
                formApi.current = null;
                setEditId(row.id);
              }}
            >
              配置
            </Button>
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              icon={<Zap size={15} strokeWidth={1.5} />}
              disabled={!configReady || !row.enabled}
              onClick={() => void handleTest(row.id)}
            >
              测试连接
            </Button>
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              icon={<CloudDownload size={15} strokeWidth={1.5} />}
              loading={fetchingId === row.id}
              disabled={!configReady || !modelsReady || !row.enabled}
              onClick={() => void handleFetchModels(row.id)}
            >
              获取模型
            </Button>
          </span>
        ),
      },
    ],
    // Row actions must use the current config snapshot and read availability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [testStates, fetchingId, pickByKey, configReady, modelsReady],
  );

  const editMeta = editId ? getProviderMeta(editId) : null;
  const editModels = editId ? models[editId] ?? [] : [];

  return (
    <>
      <PageHeader
        title="AI 提供方"
        desc={
          items.length
            ? `${summary.total} 个 Provider · ${summary.enabledCount} 个已启用 · 下游助手 / Agent / 知识库检索按「默认生效」选择实际调用的 Provider；最后更新 ${formatDateTime(items[0]?.updatedAt ?? '', settings)}`
            : '配置外部第三方模型服务；下游助手 / Agent / 知识库检索按「默认生效」选择实际调用的 Provider。'
        }
        actions={
          <>
            <Button
              icon={<Plus size={15} strokeWidth={1.5} />}
              disabled={!configReady}
              onClick={() => {
                setNewProviderName('');
                setAddOpen(true);
              }}
            >
              添加自定义 Provider
            </Button>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => {
                void load();
                void loadModels();
              }}
            >
              刷新
            </Button>
          </>
        }
      />

      {error ? <div role="alert" className="mp-read-warning">
        <strong>{error.forbidden ? '无权限读取 Provider 配置' : 'Provider 配置暂不可用'}</strong>
        <span>{error.message}</span>
        <Button loading={loading} onClick={() => void load()}>重试配置</Button>
      </div> : null}
      {modelsError ? <div role="alert" className="mp-read-warning">
        <strong>{modelsError.forbidden ? '无权限读取模型清单' : '模型清单暂不可用'}</strong>
        <span>{modelsError.message}</span>
        <Button loading={modelsLoading} onClick={() => void loadModels()}>重试模型清单</Button>
      </div> : null}

      <div className="mp-admin-kpis">
        <Card>
          <span className="mp-admin-kpi-label">已启用</span>
          <div className="mp-admin-kpi-value">{configReady ? summary.enabledCount : '未读取'}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">已配置 Base URL</span>
          <div className="mp-admin-kpi-value">{configReady ? summary.configured : '未读取'}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">Provider 数量</span>
          <div className="mp-admin-kpi-value">{configReady ? summary.total : '未读取'}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">默认生效</span>
          <div className="mp-admin-kpi-value">{!configReady ? '未读取' : defaultActive ? getProviderMeta(defaultActive).name : '未设置'}</div>
        </Card>
      </div>

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索 Provider 名称…' }}
        filters={
          <>
            <Tooltip content="下游实际调用哪个 Provider">
              <span id={`${defaultLabelId}-provider`} className="mp-admin-faint">默认 Provider</span>
            </Tooltip>
            <Select aria-labelledby={`${defaultLabelId}-provider`} disabled={!configReady} value={defaultActive}
              placeholder="未设置" onChange={(v) => void setDefaultActiveProvider(v as string)} optionList={defaultOptions} />
            <span id={`${defaultLabelId}-embedding`} className="mp-admin-faint">默认 Embedding</span>
            <Select
              aria-labelledby={`${defaultLabelId}-embedding`}
              disabled={!configReady}
              placeholder="未设置"
              value={defaultEmbedding}
              onChange={(v) => void setDefaultEmbeddingProvider(v as string)}
              optionList={embeddingOptions}
            />
          </>
        }
      />

      <DataTablePro<ProviderRow>
        columns={columns}
        dataSource={configReady ? filteredRows : []}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({ onDoubleClick: () => { if (configReady) setEditId(record.id); } })}
        empty={
          !configReady ? (
            <EmptyState illustration={error ? 'failure' : 'no-result'}
              title={loading ? '正在读取 Provider 配置' : 'Provider 配置尚未读取'}
              desc="成功读取配置后可进行管理操作。" />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的 Provider"
              desc="调整关键词，或添加一个自定义 Provider。"
            />
          )
        }
      />

      {/* 编辑单个 Provider */}
      <SheetDetail
        title={editMeta ? `配置 · ${editMeta.name}` : '配置 Provider'}
        open={editId !== null}
        onClose={() => setEditId(null)}
        footer={
          <>
            {editId ? (
              <>
                <Button
                  icon={<Zap size={15} strokeWidth={1.5} />}
                  disabled={!configReady}
                  onClick={() => void handleTest(editId)}
                >
                  测试连接
                </Button>
                <Button
                  icon={<CloudDownload size={15} strokeWidth={1.5} />}
                  loading={fetchingId === editId}
                  disabled={!configReady || !modelsReady}
                  onClick={() => void handleFetchModels(editId)}
                >
                  获取模型
                </Button>
              </>
            ) : null}
            <Button onClick={() => setEditId(null)}>取消</Button>
            <Button
              theme="solid"
              type="primary"
              loading={savingId !== null}
              disabled={!configReady}
              onClick={() => void submitProvider()}
            >
              保存
            </Button>
          </>
        }
      >
        {editId && editMeta ? (
          <div className="mp-admin-form">
            <Form
              key={editId}
              getFormApi={(api) => {
                formApi.current = api as unknown as FormApiLike;
              }}
              initValues={{
                enabled:
                  pickByKey(editId, 'enabled')?.value === true ||
                  pickByKey(editId, 'enabled')?.value === 'true',
                base_url: cfgString(pickByKey(editId, 'base_url')),
                api_key: '',
                default_model: cfgString(pickByKey(editId, 'default_model')),
                embedding_model: cfgString(pickByKey(editId, 'embedding_model')),
                api_version: cfgString(pickByKey(editId, 'api_version')),
              }}
              labelPosition="left"
              labelWidth={120}
            >
              <Form.Switch
                disabled={!configReady}
                field="enabled"
                label="启用"
                extraText="关闭后下游回退到默认 Provider"
              />
              {pickByKey(editId, 'base_url') ? (
                <Form.Input
                  disabled={!configReady}
                  field="base_url"
                  label="Base URL"
                  placeholder={editMeta.baseUrlExample}
                />
              ) : null}
              {pickByKey(editId, 'api_key') ? (
                <Form.Input
                  disabled={!configReady}
                  field="api_key"
                  label="API Key"
                  mode="password"
                  placeholder={
                    pickByKey(editId, 'api_key')?.value ? '已设置（输入新值覆盖）' : '输入 API Key'
                  }
                  extraText="托管模式：留空表示保持原值，真实 Key 不出后端"
                />
              ) : null}
              {pickByKey(editId, 'default_model') ? (
                <Form.Input
                  disabled={!configReady}
                  field="default_model"
                  label="默认模型"
                  placeholder={editMeta.defaultModelExample}
                />
              ) : null}
              {pickByKey(editId, 'embedding_model') ? (
                <Form.Input
                  disabled={!configReady}
                  field="embedding_model"
                  label="Embedding 模型"
                  placeholder={editMeta.defaultModelExample}
                />
              ) : null}
              {pickByKey(editId, 'api_version') ? (
                <Form.Input disabled={!configReady} field="api_version" label="API Version" placeholder="2024-02-01" />
              ) : null}
            </Form>

            <div className="mp-admin-section">
              <span className="mp-admin-section-label">已获取模型（{modelsReady ? editModels.length : '未读取'}）</span>
              {!modelsReady ? (
                <span className="mp-admin-faint">{modelsLoading ? '正在读取模型清单…' : '模型清单读取未完成，请先重试。'}</span>
              ) : editModels.length === 0 ? (
                <span className="mp-admin-faint">尚无模型，点击「获取模型」从上游拉取。</span>
              ) : (
                <ul className="mp-admin-list">
                  {editModels.map((m) => (
                    <li key={m.id ?? m.modelId} className="mp-admin-list-item">
                      <span className="mp-admin-mono">{m.displayName || m.modelId}</span>
                      <span className="mp-admin-row-actions">
                        <Switch
                          disabled={!configReady || !modelsReady}
                          size="small"
                          checked={m.enabled}
                          onChange={() => void handleToggleModel(m)}
                          aria-label={`启用 ${m.modelId}`}
                        />
                        <Button
                          theme="borderless"
                          type="danger"
                          size="small"
                          icon={<Trash2 size={14} strokeWidth={1.5} />}
                          onClick={() => void handleDeleteModel(m)}
                          disabled={!configReady || !modelsReady}
                          aria-label={`删除 ${m.modelId}`}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </SheetDetail>

      {/* 添加自定义 Provider */}
      <SheetDetail
        title="添加自定义 Provider"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={adding} disabled={!configReady} onClick={() => void submitCustom()}>
              添加
            </Button>
          </>
        }
      >
        <div className="mp-admin-form">
          <Input
            disabled={!configReady}
            value={newProviderName}
            onChange={setNewProviderName}
            maxLength={20}
            placeholder="例如：智谱 GLM"
          />
          <span className="mp-admin-faint">
            输入显示名称（如「智谱 GLM」「DeepSeek」「公司自建」），系统自动生成 instanceId。
          </span>
        </div>
      </SheetDetail>
    </>
  );
}
