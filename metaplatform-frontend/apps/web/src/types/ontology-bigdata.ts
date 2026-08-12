// APP-ONTSTUDIO 大数据相关类型定义
// 对应 PRD v2.2 §12 + API-CONTRACT v1.1 §4

// ==================== 通用类型 ====================
export type SourceType =
  | 'HIVE' | 'HBASE' | 'CLICKHOUSE' | 'DORIS' | 'STARROCKS'
  | 'ICEBERG' | 'HUDI' | 'DELTA' | 'PRESTO' | 'TRINO'
  | 'KAFKA' | 'PULSAR' | 'HDFS'
  | 'MYSQL' | 'POSTGRES';

export type AuthType = 'NONE' | 'USER_PASSWORD' | 'KERBERY' | 'LDAP' | 'OAUTH2';

export type BigDataSourceStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'DELETED';

export type CDCSyncMode = 'FULL_INCREMENTAL' | 'INCREMENTAL_ONLY' | 'SNAPSHOT_ONLY';
export type CDCStartPosition = 'LATEST' | 'CURRENT_TIMESTAMP' | 'CUSTOM';
export type CDCTargetType = 'KAFKA' | 'CLICKHOUSE' | 'HUDI' | 'ICEBERG';
export type CDCSchemaEvolution = 'IGNORE' | 'ADD_NEW_COLUMNS' | 'RESTRICT';
export type CDCTaskStatus = 'PENDING' | 'SNAPSHOTTING' | 'RUNNING' | 'PAUSED' | 'FAILED' | 'STOPPED';

export type ETLMode =
  | 'BATCH_SPARK' | 'BATCH_FLINK' | 'STREAMING_FLINK' | 'STREAMING_SPARK' | 'SQL_TRANSFORM';
export type ETLPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ETLWriteMode = 'OVERWRITE' | 'APPEND' | 'UPSERT' | 'MERGE';
export type ETLTargetType = 'HIVE' | 'CLICKHOUSE' | 'ICEBERG' | 'HUDI' | 'DELTA' | 'DORIS';
export type ETLTriggerType = 'MANUAL' | 'SCHEDULED' | 'EVENT';
export type ETLStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';

export type SchedulerTaskType = 'ETL_TASK' | 'CDC_TASK' | 'QUALITY_CHECK' | 'CUSTOM_ACTION';
export type SchedulerTriggerType = 'CRON' | 'EVENT' | 'MANUAL' | 'DEPENDENCY';
export type SchedulerStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'DELETED';

export type MetricType = 'ATOMIC' | 'DERIVED' | 'COMPOSITE' | 'REALTIME';
export type MetricAggregation = 'SUM' | 'AVG' | 'COUNT' | 'MAX' | 'MIN' | 'LAST';
export type MetricFrequency = 'REALTIME' | 'MINUTELY' | 'HOURLY' | 'DAILY';
export type MetricStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ERROR';

// ==================== 实体接口 ====================
export interface BigDataSource {
  sourceId: string;
  tenantId: string;
  name: string;
  sourceType: SourceType;
  description?: string;
  host: string;
  port: number;
  database?: string;
  schema?: string;
  authType: AuthType;
  sslEnabled: boolean;
  poolSize: number;
  queryTimeout: number;
  batchSize: number;
  status: BigDataSourceStatus;
  lastTestedAt?: string;
  lastErrorMessage?: string;
  tags?: string[];
  businessDomain?: string;
  ownerOrgId: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CDCTask {
  taskId: string;
  tenantId: string;
  name: string;
  sourceId: string;
  syncMode: CDCSyncMode;
  startPosition: CDCStartPosition;
  customPosition?: string;
  targetType: CDCTargetType;
  targetName: string;
  schemaEvolution: CDCSchemaEvolution;
  tables: { tableName: string; filter?: string; excludedFields?: string[] }[];
  concurrency: number;
  batchSize: number;
  retryCount: number;
  retryInterval: number;
  status: CDCTaskStatus;
  currentPhase?: string;
  totalRecords: number;
  currentBinlog?: string;
  lagMs: number;
  lastSyncAt?: string;
  errorMessage?: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ETLTask {
  taskId: string;
  tenantId: string;
  name: string;
  description?: string;
  mode: ETLMode;
  priority: ETLPriority;
  status: ETLStatus;
  sourceIds: string[];
  sourceTables: string[];
  transformDag?: any;
  transformSql?: string;
  incrementalField?: string;
  targetType: ETLTargetType;
  targetSourceId: string;
  targetTable: string;
  writeMode: ETLWriteMode;
  triggerType: ETLTriggerType;
  cron?: string;
  retryCount: number;
  timeout: number;
  alertOnFailure: boolean;
  executorNum: number;
  executorMemory: number;
  driverMemory: number;
  queue: string;
  lastRunAt?: string;
  lastRunStatus?: ETLStatus;
  lastRunDuration?: number;
  totalProcessed: number;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulerTask {
  schedulerId: string;
  tenantId: string;
  name: string;
  taskType: SchedulerTaskType;
  taskId: string;
  triggerType: SchedulerTriggerType;
  cron?: string;
  dependsOn?: string[];
  startTime: string;
  endTime?: string;
  retryCount: number;
  retryInterval: number;
  timeout: number;
  status: SchedulerStatus;
  alertOnFailure: boolean;
  alertOnTimeout: boolean;
  alertOnSuccess: boolean;
  notifyChannels: string[];
  notifyTargets: string[];
  lastTriggerAt?: string;
  nextTriggerAt?: string;
  totalTriggers: number;
  totalSuccess: number;
  totalFailure: number;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Metric {
  metricId: string;
  tenantId: string;
  name: string;
  code: string;
  type: MetricType;
  description?: string;
  sourceId: string;
  sourceTable: string;
  sourceField: string;
  aggregation: MetricAggregation;
  filter?: string;
  dimensions?: string[];
  formula?: string;
  calculationFrequency: MetricFrequency;
  alertMin?: number;
  alertMax?: number;
  alertChangeRate?: number;
  alertTargets?: string[];
  alertChannels?: string[];
  tags?: string[];
  businessDomain: string;
  status: MetricStatus;
  lastComputedAt?: string;
  lastValue?: number;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== 数据产品（Iceberg ADS / 数据湖） ====================
// mate-tech-data /data/products 返回形状。
export interface DataProduct {
  id: string;
  tenantId: string;
  name: string;
  version: number;
  sourcePaimonTable: string;
  targetIcebergTable: string;
  modality: string;          // structured | embedding | chunk | mixed
  status: string;            // draft | published | certified | suspended
  owner: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ==================== 显示辅助 ====================
export const SOURCE_TYPE_META: Record<SourceType, { label: string; color: string; icon: string }> = {
  HIVE:        { label: 'Hive',         color: '#f59e0b', icon: 'Hi' },
  HBASE:       { label: 'HBase',        color: '#ef4444', icon: 'Hb️' },
  CLICKHOUSE:  { label: 'ClickHouse',   color: '#facc15', icon: 'CK' },
  DORIS:       { label: 'Doris',        color: '#3b82f6', icon: 'Do' },
  STARROCKS:   { label: 'StarRocks',    color: '#a855f7', icon: 'SR' },
  ICEBERG:     { label: 'Iceberg',      color: '#06b6d4', icon: 'Ic' },
  HUDI:        { label: 'Hudi',         color: '#0ea5e9', icon: 'Hd' },
  DELTA:       { label: 'Delta Lake',   color: '#1e40af', icon: 'Δ'  },
  PRESTO:      { label: 'Presto',       color: '#ea580c', icon: 'Pr' },
  TRINO:       { label: 'Trino',        color: '#dc2626', icon: 'Tr' },
  KAFKA:       { label: 'Kafka',        color: '#000000', icon: 'Kf' },
  PULSAR:      { label: 'Pulsar',       color: '#7c2d12', icon: 'Pl' },
  HDFS:        { label: 'HDFS',         color: '#3b82f6', icon: 'Hd' },
  MYSQL:       { label: 'MySQL',        color: '#00758f', icon: 'My' },
  POSTGRES:    { label: 'PostgreSQL',   color: '#336791', icon: 'Pg' },
};

export const ETL_MODE_META: Record<ETLMode, { label: string; color: string; icon: string }> = {
  BATCH_SPARK:      { label: 'Batch Spark',        color: '#f59e0b', icon: 'BS' },
  BATCH_FLINK:      { label: 'Batch Flink',        color: '#3b82f6', icon: 'BF' },
  STREAMING_FLINK:  { label: 'Streaming Flink',    color: '#06b6d4', icon: 'SF' },
  STREAMING_SPARK:  { label: 'Streaming Spark',   color: '#a855f7', icon: 'SS' },
  SQL_TRANSFORM:    { label: 'SQL Transform',     color: '#10b981', icon: 'SQ' },
};

export const METRIC_TYPE_META: Record<MetricType, { label: string; color: string }> = {
  ATOMIC:     { label: '原子指标', color: '#3b82f6' },
  DERIVED:    { label: '派生指标', color: '#10b981' },
  COMPOSITE:  { label: '复合指标', color: '#a855f7' },
  REALTIME:   { label: '实时指标', color: '#ef4444' },
};
