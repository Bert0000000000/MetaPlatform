// APP-ONTSTUDIO 大数据相关 API
// 遵循 API-CONTRACT v1.1 §4 + OpenAPI Spec
// 全部带 mock fallback (catch 失败时返回 mock)

import axios from 'axios';
import {
  BigDataSource, CDCTask, ETLTask, SchedulerTask, Metric,
  SourceType, CDCSyncMode, CDCStartPosition, CDCTargetType,
  ETLMode, ETLPriority, ETLWriteMode, ETLTargetType, ETLTriggerType, ETLStatus,
  SchedulerTaskType, SchedulerTriggerType,
  MetricType, MetricAggregation, MetricFrequency, MetricStatus,
  SOURCE_TYPE_META, ETL_MODE_META, METRIC_TYPE_META,
} from '../types/ontology-bigdata';
import { MOCK_BIGDATA_SOURCES, MOCK_CDC_TASKS, MOCK_ETL_TASKS, MOCK_SCHEDULER_TASKS, MOCK_METRICS } from '../mock/ontology-bigdata';

// 显式 re-export META（让 view 文件可以从 api/ 导入）
export { SOURCE_TYPE_META, ETL_MODE_META, METRIC_TYPE_META };

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
export async function listBigDataSources(params) {
  try {
    const resp = await apiClient.get('/data/sources', { params });
    return resp.data;
  } catch (e) {
    console.warn('[ontology.bigdata] listBigDataSources use mock', e);
    let result = MOCK_BIGDATA_SOURCES;
    if (params?.keyword) {
      const k = params.keyword.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(k) || s.host.toLowerCase().includes(k));
    }
    if (params?.sourceType) result = result.filter(s => s.sourceType === params.sourceType);
    if (params?.status) result = result.filter(s => s.status === params.status);
    return result;
  }
}

export async function getBigDataSource(sourceId) {
  try {
    const resp = await apiClient.get('/data/sources/' + sourceId);
    return resp.data;
  } catch (e) {
    return MOCK_BIGDATA_SOURCES.find(s => s.sourceId === sourceId);
  }
}

export async function createBigDataSource(data) {
  try {
    const resp = await apiClient.post('/data/sources', data);
    return resp.data;
  } catch (e) {
    const mock = {
      sourceId: 'ds-mock-' + Date.now(),
      tenantId: 't-1',
      name: data.name || 'New Data Source',
      sourceType: data.sourceType || 'CLICKHOUSE',
      host: data.host || 'localhost',
      port: data.port || 8123,
      database: data.database,
      schema: data.schema,
      authType: data.authType || 'NONE',
      sslEnabled: data.sslEnabled || false,
      poolSize: data.poolSize || 10,
      queryTimeout: data.queryTimeout || 60,
      batchSize: data.batchSize || 1000,
      status: 'DRAFT',
      ownerOrgId: 'org-1',
      ownerUserId: 'u-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_BIGDATA_SOURCES.push(mock);
    return mock;
  }
}

export async function updateBigDataSource(sourceId, data) {
  try {
    const resp = await apiClient.put('/data/sources/' + sourceId, data);
    return resp.data;
  } catch (e) {
    const s = MOCK_BIGDATA_SOURCES.find(x => x.sourceId === sourceId);
    if (s) Object.assign(s, data, { updatedAt: new Date().toISOString() });
    return s;
  }
}

export async function deleteBigDataSource(sourceId) {
  try {
    await apiClient.delete('/data/sources/' + sourceId);
  } catch (e) {
    const idx = MOCK_BIGDATA_SOURCES.findIndex(s => s.sourceId === sourceId);
    if (idx >= 0) MOCK_BIGDATA_SOURCES.splice(idx, 1);
  }
  return { success: true };
}

export async function testBigDataSourceConnection(sourceId) {
  try {
    const resp = await apiClient.post('/data/sources/' + sourceId + '/test');
    return resp.data;
  } catch (e) {
    return { success: Math.random() > 0.2, latency: Math.floor(Math.random() * 200) + 10 };
  }
}

export async function discoverBigDataSchema(sourceId) {
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
export async function listCDCTasks(params) {
  try {
    const resp = await apiClient.get('/data/cdc-tasks', { params });
    return resp.data;
  } catch (e) {
    let result = MOCK_CDC_TASKS;
    if (params?.keyword) {
      const k = params.keyword.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(k));
    }
    if (params?.status) result = result.filter(t => t.status === params.status);
    return result;
  }
}

export async function getCDCTask(taskId) {
  try {
    const resp = await apiClient.get('/data/cdc-tasks/' + taskId);
    return resp.data;
  } catch (e) {
    return MOCK_CDC_TASKS.find(t => t.taskId === taskId);
  }
}

export async function createCDCTask(data) {
  try {
    const resp = await apiClient.post('/data/cdc-tasks', data);
    return resp.data;
  } catch (e) {
    const mock = {
      taskId: 'cdc-mock-' + Date.now(),
      tenantId: 't-1',
      name: data.name || 'New CDC Task',
      sourceId: data.sourceId || '',
      syncMode: data.syncMode || 'FULL_INCREMENTAL',
      startPosition: data.startPosition || 'LATEST',
      targetType: data.targetType || 'KAFKA',
      targetName: data.targetName || 'cdc_topic_default',
      schemaEvolution: data.schemaEvolution || 'ADD_NEW_COLUMNS',
      tables: data.tables || [],
      concurrency: data.concurrency || 1,
      batchSize: data.batchSize || 1000,
      retryCount: data.retryCount || 3,
      retryInterval: data.retryInterval || 60,
      status: 'PENDING',
      totalRecords: 0,
      lagMs: 0,
      ownerUserId: 'u-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_CDC_TASKS.push(mock);
    return mock;
  }
}

export async function pauseCDCTask(taskId) {
  try { await apiClient.post('/data/cdc-tasks/' + taskId + '/pause'); }
  catch (e) {
    const t = MOCK_CDC_TASKS.find(x => x.taskId === taskId);
    if (t) t.status = 'PAUSED';
  }
  return { success: true };
}

export async function resumeCDCTask(taskId) {
  try { await apiClient.post('/data/cdc-tasks/' + taskId + '/resume'); }
  catch (e) {
    const t = MOCK_CDC_TASKS.find(x => x.taskId === taskId);
    if (t) t.status = 'RUNNING';
  }
  return { success: true };
}

export async function getCDCTaskStatus(taskId) {
  try {
    const resp = await apiClient.get('/data/cdc-tasks/' + taskId + '/status');
    return resp.data;
  } catch (e) {
    return MOCK_CDC_TASKS.find(t => t.taskId === taskId);
  }
}

// ==================== ETL 任务 ====================
export async function listETLTasks(params) {
  try {
    const resp = await apiClient.get('/etl/tasks', { params });
    return resp.data;
  } catch (e) {
    let result = MOCK_ETL_TASKS;
    if (params?.keyword) {
      const k = params.keyword.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(k));
    }
    if (params?.status) result = result.filter(t => t.status === params.status);
    if (params?.mode) result = result.filter(t => t.mode === params.mode);
    return result;
  }
}

export async function getETLTask(taskId) {
  try {
    const resp = await apiClient.get('/etl/tasks/' + taskId);
    return resp.data;
  } catch (e) {
    return MOCK_ETL_TASKS.find(t => t.taskId === taskId);
  }
}

export async function createETLTask(data) {
  try {
    const resp = await apiClient.post('/etl/tasks', data);
    return resp.data;
  } catch (e) {
    const mock = {
      taskId: 'etl-mock-' + Date.now(),
      tenantId: 't-1',
      name: data.name || 'New ETL Task',
      mode: data.mode || 'BATCH_SPARK',
      priority: data.priority || 'NORMAL',
      status: 'DRAFT',
      sourceIds: data.sourceIds || [],
      sourceTables: data.sourceTables || [],
      targetType: data.targetType || 'CLICKHOUSE',
      targetSourceId: data.targetSourceId || '',
      targetTable: data.targetTable || '',
      writeMode: data.writeMode || 'APPEND',
      triggerType: data.triggerType || 'MANUAL',
      retryCount: data.retryCount || 3,
      timeout: data.timeout || 3600,
      alertOnFailure: data.alertOnFailure ?? true,
      executorNum: data.executorNum || 2,
      executorMemory: data.executorMemory || 4,
      driverMemory: data.driverMemory || 2,
      queue: data.queue || 'default',
      totalProcessed: 0,
      ownerUserId: 'u-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_ETL_TASKS.push(mock);
    return mock;
  }
}

export async function runETLTask(taskId) {
  try { await apiClient.post('/etl/tasks/' + taskId + '/run'); }
  catch (e) {
    const t = MOCK_ETL_TASKS.find(x => x.taskId === taskId);
    if (t) { t.status = 'RUNNING'; t.lastRunAt = new Date().toISOString(); }
  }
  return { success: true, executionId: 'exec-' + Date.now() };
}

export async function stopETLTask(taskId) {
  try { await apiClient.post('/etl/tasks/' + taskId + '/stop'); }
  catch (e) {
    const t = MOCK_ETL_TASKS.find(x => x.taskId === taskId);
    if (t) t.status = 'CANCELLED';
  }
  return { success: true };
}

export async function getETLTaskStatus(taskId) {
  try {
    const resp = await apiClient.get('/etl/tasks/' + taskId + '/status');
    return resp.data;
  } catch (e) {
    return MOCK_ETL_TASKS.find(t => t.taskId === taskId);
  }
}

// ==================== 调度任务 ====================
export async function listSchedulerTasks(params) {
  try {
    const resp = await apiClient.get('/scheduler/tasks', { params });
    return resp.data;
  } catch (e) {
    let result = MOCK_SCHEDULER_TASKS;
    if (params?.keyword) {
      const k = params.keyword.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(k));
    }
    if (params?.status) result = result.filter(t => t.status === params.status);
    return result;
  }
}

export async function createSchedulerTask(data) {
  try {
    const resp = await apiClient.post('/scheduler/tasks', data);
    return resp.data;
  } catch (e) {
    const mock = {
      schedulerId: 'sch-mock-' + Date.now(),
      tenantId: 't-1',
      name: data.name || 'New Scheduler',
      taskType: data.taskType || 'ETL_TASK',
      taskId: data.taskId || '',
      triggerType: data.triggerType || 'CRON',
      cron: data.cron,
      startTime: data.startTime || new Date().toISOString(),
      endTime: data.endTime,
      retryCount: data.retryCount || 3,
      retryInterval: data.retryInterval || 60,
      timeout: data.timeout || 3600,
      status: 'ACTIVE',
      alertOnFailure: data.alertOnFailure ?? true,
      alertOnTimeout: data.alertOnTimeout ?? true,
      alertOnSuccess: data.alertOnSuccess ?? false,
      notifyChannels: data.notifyChannels || ['site'],
      notifyTargets: data.notifyTargets || [],
      totalTriggers: 0,
      totalSuccess: 0,
      totalFailure: 0,
      ownerUserId: 'u-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_SCHEDULER_TASKS.push(mock);
    return mock;
  }
}

export async function triggerScheduler(schedulerId) {
  try { await apiClient.post('/scheduler/tasks/' + schedulerId + '/trigger'); }
  catch (e) {
    const t = MOCK_SCHEDULER_TASKS.find(x => x.schedulerId === schedulerId);
    if (t) {
      t.lastTriggerAt = new Date().toISOString();
      t.totalTriggers += 1;
      t.totalSuccess += 1;
    }
  }
  return { success: true, executionId: 'exec-' + Date.now() };
}

export async function pauseScheduler(schedulerId) {
  try { await apiClient.post('/scheduler/tasks/' + schedulerId + '/pause'); }
  catch (e) {
    const t = MOCK_SCHEDULER_TASKS.find(x => x.schedulerId === schedulerId);
    if (t) t.status = 'PAUSED';
  }
  return { success: true };
}

export async function resumeScheduler(schedulerId) {
  try { await apiClient.post('/scheduler/tasks/' + schedulerId + '/resume'); }
  catch (e) {
    const t = MOCK_SCHEDULER_TASKS.find(x => x.schedulerId === schedulerId);
    if (t) t.status = 'ACTIVE';
  }
  return { success: true };
}

// ==================== 数据指标 ====================
export async function listMetrics(params) {
  try {
    const resp = await apiClient.get('/metrics', { params });
    return resp.data;
  } catch (e) {
    let result = MOCK_METRICS;
    if (params?.keyword) {
      const k = params.keyword.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(k) || m.code.toLowerCase().includes(k));
    }
    if (params?.type) result = result.filter(m => m.type === params.type);
    if (params?.status) result = result.filter(m => m.status === params.status);
    return result;
  }
}

export async function createMetric(data) {
  try {
    const resp = await apiClient.post('/metrics', data);
    return resp.data;
  } catch (e) {
    const mock = {
      metricId: 'm-mock-' + Date.now(),
      tenantId: 't-1',
      name: data.name || 'New Metric',
      code: data.code || 'metric_' + Date.now(),
      type: data.type || 'ATOMIC',
      sourceId: data.sourceId || '',
      sourceTable: data.sourceTable || '',
      sourceField: data.sourceField || '',
      aggregation: data.aggregation || 'SUM',
      calculationFrequency: data.calculationFrequency || 'HOURLY',
      businessDomain: data.businessDomain || 'general',
      status: 'DRAFT',
      ownerUserId: 'u-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_METRICS.push(mock);
    return mock;
  }
}

export async function computeMetric(metricId) {
  try { await apiClient.post('/metrics/' + metricId + '/compute'); }
  catch (e) {
    const m = MOCK_METRICS.find(x => x.metricId === metricId);
    if (m) {
      m.lastComputedAt = new Date().toISOString();
      m.lastValue = Math.floor(Math.random() * 10000);
    }
  }
  return { success: true, value: m?.lastValue };
}

export async function getMetricLineage(metricId) {
  try {
    const resp = await apiClient.get('/metrics/' + metricId + '/lineage');
    return resp.data;
  } catch (e) {
    return {
      metricId,
      nodes: [
        { id: metricId, label: '指标', type: 'metric' },
        { id: 't1', label: '源表', type: 'table' },
        { id: 'c1', label: '字段', type: 'column' },
      ],
      edges: [
        { source: 'c1', target: metricId, label: '聚合' },
        { source: 't1', target: 'c1', label: '包含' },
      ],
    };
  }
}
