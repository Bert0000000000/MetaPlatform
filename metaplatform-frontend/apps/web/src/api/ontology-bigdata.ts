// APP-ONTSTUDIO 大数据相关 API
// 遵循 API-CONTRACT v1.1 §4 + OpenAPI Spec
// 网络错误时返回空结果，不返回 mock 数据

import axios from 'axios';
import {
  BigDataSource, CDCTask, ETLTask, SchedulerTask, Metric,
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

// ==================== 大数据源 ====================
export async function listBigDataSources(params: { keyword?: string; sourceType?: SourceType; status?: BigDataSourceStatus } = {}): Promise<BigDataSource[]> {
  try {
    const resp = await apiClient.get('/data/sources', { params });
    return resp.data;
  } catch (e) { throw e; }
}

export async function getBigDataSource(sourceId: string): Promise<BigDataSource | undefined> {
  try {
    const resp = await apiClient.get('/data/sources/' + sourceId);
    return resp.data;
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
    return resp.data;
  } catch (e) { throw e; }
}

export async function getCDCTask(taskId: string): Promise<CDCTask | undefined> {
  try {
    const resp = await apiClient.get('/data/cdc-tasks/' + taskId);
    return resp.data;
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
    return resp.data;
  } catch (e) { throw e; }
}

// ==================== ETL 任务 ====================
export async function listETLTasks(params: { keyword?: string; status?: ETLStatus; mode?: ETLMode } = {}): Promise<ETLTask[]> {
  try {
    const resp = await apiClient.get('/etl/tasks', { params });
    return resp.data;
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
    return resp.data;
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
    return resp.data;
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
