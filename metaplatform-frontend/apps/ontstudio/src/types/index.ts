export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  traceId?: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Concept {
  conceptId: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  parentConceptId?: string;
  parentConceptName?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  depth?: number;
  level?: number;
  path?: string;
  status: string;
  attributeIds?: string[];
  attributeCount?: number;
  entityCount?: number;
  childCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ConceptCreateRequest {
  code: string;
  name: string;
  description?: string;
  parentConceptId?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  attributeIds?: string[];
}

export interface ConceptUpdateRequest extends ConceptCreateRequest {}

export interface ConceptHierarchyNode {
  conceptId: string;
  code: string;
  name: string;
  level: number;
  children?: ConceptHierarchyNode[];
}

export interface ConceptHierarchyResponse {
  rootConceptId?: string;
  nodes: ConceptHierarchyNode[];
}

export interface Attribute {
  attributeId: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  dataType: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  enumValues?: Array<Record<string, string>>;
  constraints?: Record<string, unknown>;
  unit?: string;
  conceptCount?: number;
  concepts?: Array<{ conceptId: string; conceptName: string }>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AttributeCreateRequest {
  code: string;
  name: string;
  description?: string;
  dataType: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  enumValues?: Array<Record<string, string>>;
  constraints?: Record<string, unknown>;
  unit?: string;
}

export interface AttributeUpdateRequest extends AttributeCreateRequest {}

export interface EntityAttributeValue {
  attributeId: string;
  attributeName?: string;
  attributeCode?: string;
  dataType?: string;
  value?: unknown;
}

export interface Entity {
  entityId: string;
  tenantId: string;
  conceptId: string;
  conceptName?: string;
  code?: string;
  name: string;
  description?: string;
  attributes?: Record<string, EntityAttributeValue>;
  metadata?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface EntityCreateRequest {
  conceptId: string;
  name: string;
  code?: string;
  description?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface EntityUpdateRequest extends EntityCreateRequest {}

export interface SearchResult {
  type: 'concept' | 'entity';
  id: string;
  code?: string;
  name: string;
  description?: string;
  conceptName?: string;
}

export const DATA_TYPES = [
  { label: '字符串', value: 'String' },
  { label: '整数', value: 'Integer' },
  { label: '长整数', value: 'Long' },
  { label: '浮点数', value: 'Double' },
  { label: '布尔', value: 'Boolean' },
  { label: '日期', value: 'Date' },
  { label: '日期时间', value: 'DateTime' },
  { label: 'Decimal', value: 'Decimal' },
  { label: 'JSON', value: 'JSON' },
  { label: '引用', value: 'Reference' },
];

// ============ Data Quality Types (V12-05) ============

export type QualityDimension =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'timeliness'
  | 'uniqueness'
  | 'validity';

export type QualitySeverity = 'info' | 'warning' | 'critical';

export type QualityIssueStatus = 'open' | 'resolved' | 'ignored';

export interface QualityRule {
  ruleId: string;
  name: string;
  dimension: QualityDimension;
  description: string;
  conceptId?: string;
  attributeId?: string;
  expression: string;
  severity: QualitySeverity;
  enabled: boolean;
}

export interface QualityIssue {
  issueId: string;
  ruleId: string;
  ruleName: string;
  dimension: QualityDimension;
  severity: QualitySeverity;
  status: QualityIssueStatus;
  conceptId: string;
  conceptName?: string;
  attributeId?: string;
  attributeName?: string;
  entityId?: string;
  entityName?: string;
  message: string;
  detectedAt: string;
  resolvedAt?: string;
  suggestion?: string;
}

export interface QualityScoreCard {
  dimension: QualityDimension;
  score: number; // 0-100
  issueCount: number;
  trend: number; // delta vs last period, can be negative
}

export interface QualityOverview {
  overallScore: number;
  totalRules: number;
  enabledRules: number;
  totalIssues: number;
  openIssues: number;
  criticalIssues: number;
  lastRunAt?: string;
  scores: QualityScoreCard[];
}

// ============ Data Lineage Types (V12-05) ============

export type LineageNodeType =
  | 'datasource'
  | 'table'
  | 'field'
  | 'mapping'
  | 'concept'
  | 'attribute'
  | 'entity'
  | 'relation'
  | 'action'
  | 'output';

export interface LineageNode {
  id: string;
  label: string;
  type: LineageNodeType;
  parentId?: string;
  metadata?: {
    sourceType?: string;
    conceptId?: string;
    attributeName?: string;
    transform?: string;
    schedule?: string;
    status?: string;
  };
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: 'flow' | 'mapping' | 'reference' | 'trigger';
}

export interface DataLineage {
  nodes: LineageNode[];
  edges: LineageEdge[];
  rootId?: string;
}

export interface LineageImpactResult {
  impactedNodes: string[];
  upstreamCount: number;
  downstreamCount: number;
  impactPath: string[];
}

// ============ Decision Table & Test Cases (V12-06) ============

/** 决策表命中策略 */
export type HitPolicy = 'first' | 'all' | 'priority' | 'unique' | 'collect';

/** 决策表列比较运算符 */
export type DecisionTableOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'in'
  | 'contains'
  | 'between';

/** 决策表列类型 */
export type DecisionTableColumnType = 'input' | 'output';

/** 决策表列定义 */
export interface DecisionTableColumn {
  id: string;
  name: string;
  field: string; // 绑定的本体属性字段
  columnType: DecisionTableColumnType;
  operator?: DecisionTableOperator;
  defaultValue?: string;
}

/** 决策表单元格 */
export interface DecisionTableCell {
  value: string;
  isEmpty?: boolean; // 表示 "-"（任意值）
}

/** 决策表行（一条规则） */
export interface DecisionTableRow {
  id: string;
  cells: Record<string, DecisionTableCell>; // columnId -> cell
  enabled: boolean;
  priority: number;
  description?: string;
}

/** 决策表 */
export interface DecisionTable {
  id: string;
  code: string;
  name: string;
  description?: string;
  conceptId?: string;
  hitPolicy: HitPolicy;
  columns: DecisionTableColumn[];
  rows: DecisionTableRow[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 决策表创建/更新请求载荷 */
export type DecisionTablePayload = Omit<DecisionTable, 'id' | 'createdAt' | 'updatedAt'>;

/** 决策表执行结果 */
export interface DecisionTableExecutionResult {
  matchedRows: DecisionTableRow[];
  outputs: Record<string, unknown>[];
}

/** 测试用例状态 */
export type TestCaseStatus = 'pending' | 'pass' | 'fail' | 'error';

/** 测试用例 */
export interface TestCase {
  id: string;
  ruleId?: string;
  decisionTableId?: string;
  name: string;
  description?: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  actualOutput?: Record<string, unknown>;
  status: TestCaseStatus;
  executedAt?: string;
  errorMessage?: string;
}

/** 测试用例创建/更新请求载荷 */
export type TestCasePayload = Omit<TestCase, 'id' | 'actualOutput' | 'status' | 'executedAt' | 'errorMessage'>;

/** 测试运行结果 */
export interface TestRun {
  id: string;
  ruleId?: string;
  decisionTableId?: string;
  startedAt: string;
  finishedAt?: string;
  totalCases: number;
  passedCount: number;
  failedCount: number;
  errorCount: number;
  results: TestCase[];
}

/** 测试运行请求载荷 */
export interface TestRunRequest {
  ruleId?: string;
  decisionTableId?: string;
  testCaseIds?: string[];
}
