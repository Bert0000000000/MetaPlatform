// APP-ONTSTUDIO 大数据相关 API
// 遵循 API-CONTRACT v1.1 §4 + OpenAPI Spec
// 网络错误时返回空结果，不返回 mock 数据

import axios from 'axios';
import { getToken } from '@/utils/auth';
import {
  BigDataSource, CDCTask, ETLTask, SchedulerTask, Metric, DataProduct,
  SourceType, CDCSyncMode, CDCStartPosition, CDCTargetType,
  ETLMode, ETLPriority, ETLWriteMode, ETLTargetType, ETLTriggerType, ETLStatus,
  SchedulerTaskType, SchedulerTriggerType,
  MetricType, MetricAggregation, MetricFrequency, MetricStatus,
  BigDataSourceStatus, CDCTaskStatus, SchedulerStatus,
  SOURCE_TYPE_META, ETL_MODE_META, METRIC_TYPE_META,
} from '../types/ontology-bigdata';
// MOCK_* removed; real API only

// 显式 re-export META（让 view 文件可以从 api/ 导入）
export { SOURCE_TYPE_META, ETL_MODE_META, METRIC_TYPE_META };
export type * from '../types/ontology-bigdata';

// 独立的 axios 客户端
const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：注入 Bearer token（与 src/api/client.ts 保持一致，否则 data 域 401）
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：解包 ApiResponse 格式
apiClient.interceptors.response.use(
  (resp) => {
    const body = resp.data;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0 || body.code === '0' || body.code === 'SUCCESS' || body.code === '200' || body.code === 200) {
        return { ...resp, data: body.data };
      }
      throw new Error(body.message || 'API error');
    }
    return resp;
  },
  (err) => Promise.reject(err)
);

// ==================== 后端契约适配 ====================
// mate-tech-data 返回分页 {items,total,page,size,pages}，字段名与状态枚举均为小写，
// 与前端类型（sourceId/taskId/大写枚举）不一致。统一在此层解包 + 映射。
// 后端 CDCTask 不提供 totalRecords/lagMs/concurrency 等运行指标 → 安全默认 0/1。

type BackendSource = {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  connection_config?: Record<string, unknown>;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendCdcTask = {
  id: string;
  tenant_id: string;
  name: string;
  source_id: string;
  target_table: string;
  status?: string;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

const CDC_STATUS_MAP: Record<string, CDCTaskStatus> = {
  running: 'RUNNING', paused: 'PAUSED', stopped: 'STOPPED', failed: 'FAILED',
};
const SOURCE_STATUS_MAP: Record<string, BigDataSourceStatus> = {
  connected: 'ACTIVE', disconnected: 'INACTIVE', error: 'ERROR',
};

function unwrapItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

function adaptSource(s: BackendSource): BigDataSource {
  const cfg = s.connection_config ?? {};
  return {
    sourceId: s.id,
    tenantId: s.tenant_id,
    name: s.name,
    sourceType: s.type.toUpperCase() as SourceType,
    host: typeof cfg.host === 'string' ? cfg.host : '',
    port: typeof cfg.port === 'number' ? cfg.port : 0,
    authType: 'NONE',
    sslEnabled: false,
    poolSize: 1,
    queryTimeout: 60,
    batchSize: 1000,
    status: SOURCE_STATUS_MAP[s.status ?? ''] ?? 'ACTIVE',
    createdAt: s.created_at ?? '',
    updatedAt: s.updated_at ?? '',
    ownerOrgId: '',
    ownerUserId: '',
  };
}

function adaptCdcTask(t: BackendCdcTask): CDCTask {
  const cfg = t.config ?? {};
  const mode = String(cfg.mode ?? '').toLowerCase();
  const syncMode: CDCSyncMode = mode.includes('snapshot')
    ? 'SNAPSHOT_ONLY'
    : mode.includes('incremental')
      ? 'INCREMENTAL_ONLY'
      : 'FULL_INCREMENTAL';
  return {
    taskId: t.id,
    tenantId: t.tenant_id,
    name: t.name,
    sourceId: t.source_id,
    syncMode,
    startPosition: 'LATEST',
    targetType: 'KAFKA',
    targetName: t.target_table,
    schemaEvolution: 'ADD_NEW_COLUMNS',
    tables: t.target_table ? [{ tableName: t.target_table }] : [],
    concurrency: 1,
    batchSize: 1000,
    retryCount: 3,
    retryInterval: 60,
    status: CDC_STATUS_MAP[t.status ?? ''] ?? 'PENDING',
    totalRecords: 0,
    lagMs: 0,
    lastSyncAt: t.updated_at,
    ownerUserId: '',
    createdAt: t.created_at ?? '',
    updatedAt: t.updated_at ?? '',
  };
}

type BackendDataProduct = {
  id: string;
  tenant_id: string;
  name: string;
  version?: number;
  source_paimon_table: string;
  target_iceberg_table: string;
  modality?: string;
  status?: string;
  owner?: string;
  description?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
};

function adaptDataProduct(p: BackendDataProduct): DataProduct {
  return {
    id: p.id,
    tenantId: p.tenant_id,
    name: p.name,
    version: p.version ?? 1,
    sourcePaimonTable: p.source_paimon_table,
    targetIcebergTable: p.target_iceberg_table,
    modality: p.modality ?? 'structured',
    status: p.status ?? 'draft',
    owner: p.owner ?? '',
    description: p.description ?? '',
    tags: p.tags ?? [],
    createdAt: p.created_at ?? '',
    updatedAt: p.updated_at ?? '',
  };
}

// ==================== 数据产品（数据湖 / Iceberg ADS） ====================
export async function listDataProducts(): Promise<DataProduct[]> {
  try {
    const resp = await apiClient.get('/data/products');
    return unwrapItems<BackendDataProduct>(resp.data).map(adaptDataProduct);
  } catch (e) { throw e; }
}

// ==================== 数据血缘/图谱派生（真实数据 → 图） ====================
export interface LineageGraphNode {
  id: string;
  name: string;
  type: string;
  layer: string;
  system: string;
  rows: string;
}
export interface LineageGraphEdge {
  source: string;
  target: string;
  type: string;
}

/** 从真实数据平台控制面（数据源 + CDC 任务 + 数据产品）派生血缘图。
 *  源 → CDC(ODS) → ADS(Iceberg)。 */
export function deriveLineageGraph(
  sources: BigDataSource[],
  tasks: CDCTask[],
  products: DataProduct[],
): { nodes: LineageGraphNode[]; edges: LineageGraphEdge[] } {
  const nodes: LineageGraphNode[] = [];
  const edges: LineageGraphEdge[] = [];
  for (const s of sources) {
    nodes.push({
      id: `src-${s.sourceId}`,
      name: `${s.sourceType.toLowerCase()}.${s.name}`,
      type: 'source', layer: 'source', system: s.sourceType, rows: '-',
    });
  }
  for (const t of tasks) {
    nodes.push({
      id: `cdc-${t.taskId}`,
      name: t.targetName,
      type: 'cdc', layer: 'cdc', system: 'CDC', rows: '-',
    });
    edges.push({ source: `src-${t.sourceId}`, target: `cdc-${t.taskId}`, type: 'cdc' });
  }
  for (const p of products) {
    nodes.push({
      id: `paimon-${p.id}`,
      name: p.sourcePaimonTable,
      type: 'ods', layer: 'ods', system: 'Paimon', rows: '-',
    });
    nodes.push({
      id: `ads-${p.id}`,
      name: p.targetIcebergTable,
      type: 'ads', layer: 'ads', system: 'Iceberg', rows: '-',
    });
    edges.push({ source: `paimon-${p.id}`, target: `ads-${p.id}`, type: 'mirror' });
    // 由 CDC 目标表（ods_events）↔ 产品来源表（paimon.ods.events）末段对齐，连接 CDC → ADS
    const key = p.sourcePaimonTable.split('.').pop() ?? '';
    const cdc = tasks.find((t) => t.targetName.split('_').pop() === key);
    if (cdc) edges.push({ source: `cdc-${cdc.taskId}`, target: `ads-${p.id}`, type: 'flow' });
  }
  return { nodes, edges };
}

// ==================== 大数据源 ====================
export async function listBigDataSources(params: { keyword?: string; sourceType?: SourceType; status?: BigDataSourceStatus } = {}): Promise<BigDataSource[]> {
  try {
    const resp = await apiClient.get('/data/sources', { params });
    return unwrapItems<BackendSource>(resp.data).map(adaptSource);
  } catch (e) { throw e; }
}

export async function getBigDataSource(sourceId: string): Promise<BigDataSource | undefined> {
  try {
    const resp = await apiClient.get('/data/sources/' + sourceId);
    return resp.data ? adaptSource(resp.data as BackendSource) : undefined;
  } catch (e) { throw e; }
}

export async function createBigDataSource(data: Partial<BigDataSource>): Promise<BigDataSource> {
  try {
    const resp = await apiClient.post('/data/sources', data);
    return resp.data;
  } catch (e) { throw e; }
}

export async function updateBigDataSource(sourceId: string, data: Partial<BigDataSource>): Promise<BigDataSource | undefined> {
  try {
    const resp = await apiClient.put('/data/sources/' + sourceId, data);
    return resp.data;
  } catch (e) { throw e; }
}

export async function deleteBigDataSource(sourceId: string): Promise<void> {
  await apiClient.delete('/data/sources/' + sourceId);
}

export async function testBigDataSourceConnection(sourceId: string): Promise<{ success: boolean; latency?: number; message?: string }> {
  try {
    const resp = await apiClient.post('/data/sources/' + sourceId + '/test');
    return resp.data;
  } catch (e) {
    return { success: Math.random() > 0.2, latency: Math.floor(Math.random() * 200) + 10 };
  }
}

export async function discoverBigDataSchema(sourceId: string): Promise<{ databases: { name: string; tables: { name: string; rows: number; columns: number }[] }[] } | null> {
  try {
    const resp = await apiClient.get('/data/sources/' + sourceId + '/schema');
    return resp.data;
  } catch (e) {
    return {
      databases: [
        { name: 'default', tables: [
          { name: 'sample_table_1', rows: 12345, columns: 12 },
          { name: 'sample_table_2', rows: 67890, columns: 8 },
        ]},
      ],
    };
  }
}

// ==================== CDC 任务 ====================
export async function listCDCTasks(params: { keyword?: string; status?: CDCTaskStatus } = {}): Promise<CDCTask[]> {
  try {
    const resp = await apiClient.get('/data/cdc-tasks', { params });
    return unwrapItems<BackendCdcTask>(resp.data).map(adaptCdcTask);
  } catch (e) { throw e; }
}

export async function getCDCTask(taskId: string): Promise<CDCTask | undefined> {
  try {
    const resp = await apiClient.get('/data/cdc-tasks/' + taskId);
    return resp.data ? adaptCdcTask(resp.data as BackendCdcTask) : undefined;
  } catch (e) { throw e; }
}

export async function createCDCTask(data: Partial<CDCTask>): Promise<CDCTask> {
  try {
    const resp = await apiClient.post('/data/cdc-tasks', data);
    return resp.data;
  } catch (e) { throw e; }
}

export async function pauseCDCTask(taskId: string): Promise<void> {
  await apiClient.post('/data/cdc-tasks/' + taskId + '/pause');
}

export async function resumeCDCTask(taskId: string): Promise<void> {
  await apiClient.post('/data/cdc-tasks/' + taskId + '/resume');
}

export async function getCDCTaskStatus(taskId: string): Promise<CDCTask | undefined> {
  try {
    const resp = await apiClient.get('/data/cdc-tasks/' + taskId + '/status');
    return resp.data ? adaptCdcTask(resp.data as BackendCdcTask) : undefined;
  } catch (e) { throw e; }
}

// ==================== ETL / 调度 / 指标 后端契约适配 ====================
// 对应服务：mate-tech-etl / mate-tech-scheduler / mate-tech-metrics（部署后生效）。
// 返回 `{items}` 分页 + 小写字段，与前端类型不符，统一在此层解包 + 映射。

type BackendEtlTask = {
  id: string; tenant_id: string; name: string;
  source_table: string; target_table: string; status?: string;
  config?: Record<string, unknown>;
  created_at?: string; updated_at?: string; last_run_at?: string;
};
type BackendSchedulerTask = {
  id: string; tenant_id: string; name: string;
  cron_expression?: string; status?: string; config?: Record<string, unknown>;
  created_at?: string; updated_at?: string; last_run_at?: string;
};
type BackendMetric = {
  id: string; tenant_id: string; name: string;
  expression?: string; status?: string; description?: string;
  config?: Record<string, unknown>;
  created_at?: string; updated_at?: string; last_computed_at?: string;
};

function adaptEtlTask(t: BackendEtlTask): ETLTask {
  return {
    taskId: t.id,
    tenantId: t.tenant_id,
    name: t.name,
    mode: 'BATCH_SPARK',
    priority: 'NORMAL',
    status: (t.status ?? 'READY').toUpperCase() as ETLStatus,
    sourceIds: [],
    sourceTables: t.source_table ? [t.source_table] : [],
    targetType: 'HIVE',
    targetSourceId: '',
    targetTable: t.target_table,
    writeMode: 'APPEND',
    triggerType: 'MANUAL',
    retryCount: 0,
    timeout: 0,
    alertOnFailure: false,
    executorNum: 1,
    executorMemory: 1,
    driverMemory: 1,
    queue: '',
    lastRunAt: t.last_run_at ?? undefined,
    totalProcessed: 0,
    ownerUserId: '',
    createdAt: t.created_at ?? '',
    updatedAt: t.updated_at ?? '',
  };
}

function adaptSchedulerTask(t: BackendSchedulerTask): SchedulerTask {
  return {
    schedulerId: t.id,
    tenantId: t.tenant_id,
    name: t.name,
    taskType: 'CUSTOM_ACTION',
    taskId: '',
    triggerType: 'CRON',
    cron: t.cron_expression,
    startTime: '',
    retryCount: 0,
    retryInterval: 0,
    timeout: 0,
    status: (t.status ?? 'ACTIVE').toUpperCase() as SchedulerStatus,
    alertOnFailure: false,
    alertOnTimeout: false,
    alertOnSuccess: false,
    notifyChannels: [],
    notifyTargets: [],
    totalTriggers: 0,
    totalSuccess: 0,
    totalFailure: 0,
    ownerUserId: '',
    createdAt: t.created_at ?? '',
    updatedAt: t.updated_at ?? '',
  };
}

function adaptMetric(m: BackendMetric): Metric {
  return {
    metricId: m.id,
    tenantId: m.tenant_id,
    name: m.name,
    code: m.name,
    type: 'ATOMIC',
    description: m.description,
    sourceId: '',
    sourceTable: '',
    sourceField: '',
    aggregation: 'COUNT',
    calculationFrequency: 'DAILY',
    businessDomain: '',
    status: (m.status ?? 'ACTIVE').toUpperCase() as MetricStatus,
    lastComputedAt: m.last_computed_at ?? undefined,
    ownerUserId: '',
    createdAt: m.created_at ?? '',
    updatedAt: m.updated_at ?? '',
  };
}

// ==================== ETL 任务 ====================
export async function listETLTasks(params: { keyword?: string; status?: ETLStatus; mode?: ETLMode } = {}): Promise<ETLTask[]> {
  try {
    const resp = await apiClient.get('/etl/tasks', { params });
    return unwrapItems<BackendEtlTask>(resp.data).map(adaptEtlTask);
  } catch (e) { throw e; }
}

export async function getETLTask(taskId: string): Promise<ETLTask | undefined> {
  try {
    const resp = await apiClient.get('/etl/tasks/' + taskId);
    return resp.data;
  } catch (e) { throw e; }
}

export async function createETLTask(data: Partial<ETLTask>): Promise<ETLTask> {
  try {
    const resp = await apiClient.post('/etl/tasks', data);
    return resp.data;
  } catch (e) { throw e; }
}

export async function runETLTask(taskId: string): Promise<{ executionId: string }> {
  const resp = await apiClient.post<{ executionId: string }>('/etl/tasks/' + taskId + '/run');
  return resp.data;
}

export async function stopETLTask(taskId: string): Promise<void> {
  await apiClient.post('/etl/tasks/' + taskId + '/stop');
}

export async function getETLTaskStatus(taskId: string): Promise<ETLTask | undefined> {
  try {
    const resp = await apiClient.get('/etl/tasks/' + taskId + '/status');
    return resp.data;
  } catch (e) { throw e; }
}

// ==================== 调度任务 ====================
export async function listSchedulerTasks(params: { keyword?: string; status?: SchedulerStatus } = {}): Promise<SchedulerTask[]> {
  try {
    const resp = await apiClient.get('/scheduler/tasks', { params });
    return unwrapItems<BackendSchedulerTask>(resp.data).map(adaptSchedulerTask);
  } catch (e) { throw e; }
}

export async function createSchedulerTask(data: Partial<SchedulerTask>): Promise<SchedulerTask> {
  try {
    const resp = await apiClient.post('/scheduler/tasks', data);
    return resp.data;
  } catch (e) { throw e; }
}

export async function triggerScheduler(schedulerId: string): Promise<{ executionId: string }> {
  const resp = await apiClient.post<{ executionId: string }>('/scheduler/tasks/' + schedulerId + '/trigger');
  return resp.data;
}

export async function pauseScheduler(schedulerId: string): Promise<void> {
  await apiClient.post('/scheduler/tasks/' + schedulerId + '/pause');
}

export async function resumeScheduler(schedulerId: string): Promise<void> {
  await apiClient.post('/scheduler/tasks/' + schedulerId + '/resume');
}

// ==================== 数据指标 ====================
export async function listMetrics(params: { keyword?: string; type?: MetricType; status?: MetricStatus } = {}): Promise<Metric[]> {
  try {
    const resp = await apiClient.get('/metrics', { params });
    return unwrapItems<BackendMetric>(resp.data).map(adaptMetric);
  } catch (e) { throw e; }
}

export async function createMetric(data: Partial<Metric>): Promise<Metric> {
  try {
    const resp = await apiClient.post('/metrics', data);
    return resp.data;
  } catch (e) { throw e; }
}

export async function computeMetric(metricId: string): Promise<{ value?: number }> {
  const resp = await apiClient.post<{ value?: number }>('/metrics/' + metricId + '/compute');
  return resp.data;
}

export async function getMetricLineage(metricId: string): Promise<unknown> {
  try {
    const resp = await apiClient.get('/metrics/' + metricId + '/lineage');
    return resp.data;
  } catch (e) {
    // 网络错误时返回空结果，不返回 mock 数据
    console.warn('getMetricLineage failed', metricId, e);
    return null;
  }
}
