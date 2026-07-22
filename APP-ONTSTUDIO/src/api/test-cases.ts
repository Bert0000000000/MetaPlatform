import { get, post, put, del } from './client';
import type {
  TestCase,
  TestCasePayload,
  TestRun,
  TestRunRequest,
} from '@/types';

/**
 * V11-03: APP-ONTSTUDIO 测试用例 API 后端化。
 *
 * 后端在 TECH-RULE 的 TestCaseController 实现：
 *   - GET    /v1/rule/test-cases                  列表（支持 ruleId/targetType/targetId 过滤）
 *   - GET    /v1/rule/test-cases/:id              详情
 *   - POST   /v1/rule/test-cases                  创建
 *   - PUT    /v1/rule/test-cases/:id              更新
 *   - DELETE /v1/rule/test-cases/:id              删除
 *   - POST   /v1/rule/test-cases/:id/run          单条运行
 *   - POST   /v1/rule/test-cases/run              批量运行（V11-03 新增）
 *
 * 字段映射：前端用 decisionTableId，后端用 targetType='DECISION_TABLE' + targetId。
 * 此文件统一负责字段双向转换。
 */

const DECISION_TABLE_TARGET_TYPE = 'DECISION_TABLE';

/** 后端原始 TestCase 响应。 */
interface TestCaseBackend {
  id: string;
  tenantId?: string;
  ruleId?: string;
  rulesetId?: string;
  targetType?: string;
  targetId?: string;
  name: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  actualOutput?: Record<string, unknown>;
  status?: string; // PENDING / PASS / FAIL / ERROR
  createdAt?: string;
  updatedAt?: string;
}

function normalizeStatus(raw: string | undefined): TestCase['status'] {
  if (!raw) return 'pending';
  const lower = raw.toLowerCase();
  if (lower === 'pass') return 'pass';
  if (lower === 'fail') return 'fail';
  if (lower === 'error') return 'error';
  return 'pending';
}

function normalizeTestCase(raw: TestCaseBackend): TestCase {
  const isDecisionTable = raw.targetType?.toUpperCase() === DECISION_TABLE_TARGET_TYPE;
  return {
    id: raw.id,
    ruleId: raw.ruleId,
    decisionTableId: isDecisionTable ? raw.targetId : undefined,
    name: raw.name,
    input: raw.input,
    expectedOutput: raw.expectedOutput,
    actualOutput: raw.actualOutput,
    status: normalizeStatus(raw.status),
    executedAt: raw.updatedAt ?? raw.createdAt,
  };
}

/** 后端批量运行入参。 */
interface TestRunBackendRequest {
  testCaseIds?: string[];
  ruleId?: string;
  targetType?: string;
  targetId?: string;
}

/** 后端批量运行响应。 */
interface TestRunBackendResult {
  id: string;
  ruleId?: string;
  decisionTableId?: string;
  startedAt?: string;
  finishedAt?: string;
  totalCases?: number;
  passedCount?: number;
  failedCount?: number;
  errorCount?: number;
  results?: TestCaseBackend[];
}

function normalizeTestRun(raw: TestRunBackendResult): TestRun {
  return {
    id: raw.id,
    ruleId: raw.ruleId,
    decisionTableId: raw.decisionTableId,
    startedAt: raw.startedAt ?? '',
    finishedAt: raw.finishedAt,
    totalCases: raw.totalCases ?? 0,
    passedCount: raw.passedCount ?? 0,
    failedCount: raw.failedCount ?? 0,
    errorCount: raw.errorCount ?? 0,
    results: (raw.results ?? []).map(normalizeTestCase),
  };
}

/** 前端 TestCasePayload -> 后端 CreateTestCaseRequest。 */
function toCreatePayload(payload: TestCasePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: payload.name,
    input: payload.input,
    expectedOutput: payload.expectedOutput,
  };
  if (payload.ruleId) body.ruleId = payload.ruleId;
  if (payload.decisionTableId) {
    body.targetType = DECISION_TABLE_TARGET_TYPE;
    body.targetId = payload.decisionTableId;
  }
  return body;
}

/** 前端 TestCasePayload -> 后端 UpdateTestCaseRequest。 */
function toUpdatePayload(payload: TestCasePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: payload.name,
    input: payload.input,
    expectedOutput: payload.expectedOutput,
  };
  if (payload.decisionTableId) {
    body.targetType = DECISION_TABLE_TARGET_TYPE;
    body.targetId = payload.decisionTableId;
  }
  return body;
}

/**
 * 列出测试用例（可按 ruleId 或 decisionTableId 过滤）。
 * 后端路径：GET /v1/rule/test-cases
 */
export async function listTestCases(
  ruleId?: string,
  decisionTableId?: string,
): Promise<TestCase[]> {
  const params: Record<string, string> = {};
  if (ruleId) params.ruleId = ruleId;
  if (decisionTableId) {
    params.targetType = DECISION_TABLE_TARGET_TYPE;
    params.targetId = decisionTableId;
  }
  const data = await get<TestCaseBackend[]>(
    '/v1/rule/test-cases',
    Object.keys(params).length > 0 ? params : undefined,
  );
  return (data ?? []).map(normalizeTestCase);
}

/**
 * 创建测试用例。
 * 后端路径：POST /v1/rule/test-cases
 */
export async function createTestCase(payload: TestCasePayload): Promise<TestCase> {
  const raw = await post<TestCaseBackend>('/v1/rule/test-cases', toCreatePayload(payload));
  return normalizeTestCase(raw);
}

/**
 * 更新测试用例。
 * 后端路径：PUT /v1/rule/test-cases/:id
 */
export async function updateTestCase(
  id: string,
  payload: TestCasePayload,
): Promise<TestCase> {
  const raw = await put<TestCaseBackend>(`/v1/rule/test-cases/${id}`, toUpdatePayload(payload));
  return normalizeTestCase(raw);
}

/**
 * 删除测试用例。
 * 后端路径：DELETE /v1/rule/test-cases/:id
 */
export async function deleteTestCase(id: string): Promise<void> {
  await del<void>(`/v1/rule/test-cases/${id}`);
}

/**
 * 批量运行测试用例。
 * 后端路径：POST /v1/rule/test-cases/run
 *
 * 后端会逐条执行（对 decisionTable 类用例调用决策表执行引擎），
 * 并返回聚合的 TestRun 结果（含 passedCount/failedCount/errorCount/results）。
 */
export async function runTestCases(payload: TestRunRequest): Promise<TestRun> {
  const body: TestRunBackendRequest = {};
  if (payload.testCaseIds && payload.testCaseIds.length > 0) {
    body.testCaseIds = payload.testCaseIds;
  }
  if (payload.ruleId) body.ruleId = payload.ruleId;
  if (payload.decisionTableId) {
    body.targetType = DECISION_TABLE_TARGET_TYPE;
    body.targetId = payload.decisionTableId;
  }
  const raw = await post<TestRunBackendResult>('/v1/rule/test-cases/run', body);
  return normalizeTestRun(raw);
}

/**
 * 列出最近的测试运行。
 *
 * 注意：后端 V1.1 阶段尚未持久化测试运行历史，暂返回空数组。
 * V1.2 阶段会通过 ExecutionLog 表补全该端点。
 */
export async function listTestRuns(_ruleId?: string): Promise<TestRun[]> {
  return [];
}
