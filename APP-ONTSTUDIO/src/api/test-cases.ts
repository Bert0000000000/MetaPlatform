import { get, post, put, del } from './client';
import type {
  TestCase,
  TestCasePayload,
  TestRun,
  TestRunRequest,
} from '@/types';
import { executeDecisionTable } from './decision-tables';

const CASES_CACHE_KEY = 'mate_platform_test_cases';
const RUNS_CACHE_KEY = 'mate_platform_test_runs';

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** 默认测试用例：覆盖订单折扣与客户分级场景 */
const DEFAULT_TEST_CASES: TestCase[] = [
  {
    id: 'tc-001',
    decisionTableId: 'dt-001',
    name: 'VIP 大单应享 8 折 + 高档礼品',
    description: '订单金额 ≥ 10000 且 isVip=true，预期命中 row-1',
    input: { amount: 15000, customerLevel: 'A', isVip: true },
    expectedOutput: { discountRate: '0.8', gift: '高档礼品' },
    status: 'pending',
  },
  {
    id: 'tc-002',
    decisionTableId: 'dt-001',
    name: 'A 级客户 5000 元订单 9 折',
    description: '订单金额 = 5000，客户等级 = A，isVip=false',
    input: { amount: 5000, customerLevel: 'A', isVip: false },
    expectedOutput: { discountRate: '0.9', gift: '标准礼品' },
    status: 'pending',
  },
  {
    id: 'tc-003',
    decisionTableId: 'dt-001',
    name: '小额订单默认无折扣',
    description: '订单金额 = 800，无客户等级，命中默认行',
    input: { amount: 800, customerLevel: 'C', isVip: false },
    expectedOutput: { discountRate: '1.0', gift: null },
    status: 'pending',
  },
  {
    id: 'tc-004',
    decisionTableId: 'dt-002',
    name: '钻石客户判定',
    description: '年消费 60w，活跃 320 天，投诉 1 次',
    input: { yearAmount: 600000, activeDays: 320, complaintCount: 1 },
    expectedOutput: { level: 'S', discountLevel: 'VIP1' },
    status: 'pending',
  },
  {
    id: 'tc-005',
    decisionTableId: 'dt-002',
    name: '普通客户判定',
    description: '年消费 1w，活跃 30 天，命中默认行',
    input: { yearAmount: 10000, activeDays: 30, complaintCount: 0 },
    expectedOutput: { level: 'C', discountLevel: 'NORMAL' },
    status: 'pending',
  },
];

function getLocalCases(): TestCase[] {
  return readLocal<TestCase[]>(CASES_CACHE_KEY) ?? DEFAULT_TEST_CASES;
}

function setLocalCases(cases: TestCase[]): void {
  writeLocal(CASES_CACHE_KEY, cases);
}

function getLocalRuns(): TestRun[] {
  return readLocal<TestRun[]>(RUNS_CACHE_KEY) ?? [];
}

function setLocalRuns(runs: TestRun[]): void {
  writeLocal(RUNS_CACHE_KEY, runs);
}

/**
 * 列出测试用例（可按 ruleId 或 decisionTableId 过滤）。
 * 后端路径：GET /v1/rule/test-cases
 */
export async function listTestCases(
  ruleId?: string,
  decisionTableId?: string,
): Promise<TestCase[]> {
  try {
    const params: Record<string, string> = {};
    if (ruleId) params.ruleId = ruleId;
    if (decisionTableId) params.decisionTableId = decisionTableId;
    const data = await get<TestCase[]>(
      '/v1/rule/test-cases',
      Object.keys(params).length > 0 ? params : undefined,
    );
    if (data && Array.isArray(data)) {
      setLocalCases(data);
      return data;
    }
    throw new Error('Empty test cases');
  } catch {
    let base = getLocalCases();
    if (ruleId) base = base.filter((c) => c.ruleId === ruleId);
    if (decisionTableId) base = base.filter((c) => c.decisionTableId === decisionTableId);
    return base;
  }
}

/**
 * 创建测试用例。
 * 后端路径：POST /v1/rule/test-cases
 */
export async function createTestCase(payload: TestCasePayload): Promise<TestCase> {
  try {
    const created = await post<TestCase>('/v1/rule/test-cases', payload);
    setLocalCases([...getLocalCases(), created]);
    return created;
  } catch {
    const created: TestCase = {
      ...payload,
      id: `tc-${Date.now().toString(36)}`,
      status: 'pending',
    };
    setLocalCases([...getLocalCases(), created]);
    return created;
  }
}

/**
 * 更新测试用例。
 * 后端路径：PUT /v1/rule/test-cases/:id
 */
export async function updateTestCase(
  id: string,
  payload: TestCasePayload,
): Promise<TestCase> {
  try {
    const updated = await put<TestCase>(`/v1/rule/test-cases/${id}`, payload);
    setLocalCases(getLocalCases().map((c) => (c.id === id ? updated : c)));
    return updated;
  } catch {
    const existing = getLocalCases().find((c) => c.id === id);
    const updated: TestCase = {
      ...(existing ?? { id, status: 'pending' as const }),
      ...payload,
      id,
    };
    setLocalCases(getLocalCases().map((c) => (c.id === id ? updated : c)));
    return updated;
  }
}

/**
 * 删除测试用例。
 * 后端路径：DELETE /v1/rule/test-cases/:id
 */
export async function deleteTestCase(id: string): Promise<void> {
  try {
    await del<void>(`/v1/rule/test-cases/${id}`);
  } catch {
    /* ignore */
  }
  setLocalCases(getLocalCases().filter((c) => c.id !== id));
}

/**
 * 批量运行测试用例。
 * 后端路径：POST /v1/rule/test-cases/run
 */
export async function runTestCases(payload: TestRunRequest): Promise<TestRun> {
  let runResults: TestCase[];

  // 本地兜底：先调决策表执行，再用 expectedOutput 对比
  const allCases = getLocalCases().filter((c) => {
    if (payload.testCaseIds && payload.testCaseIds.length > 0) {
      return payload.testCaseIds.includes(c.id);
    }
    if (payload.ruleId && c.ruleId !== payload.ruleId) return false;
    if (payload.decisionTableId && c.decisionTableId !== payload.decisionTableId) return false;
    return true;
  });

  try {
    // 优先尝试后端
    const remote = await post<TestRun>('/v1/rule/test-cases/run', payload);
    setLocalRuns([remote, ...getLocalRuns()].slice(0, 50));
    return remote;
  } catch {
    // 本地模拟执行
    runResults = await Promise.all(
      allCases.map(async (c): Promise<TestCase> => {
        try {
          let actual: Record<string, unknown> | undefined;
          if (c.decisionTableId) {
            const exec = await executeDecisionTable(c.decisionTableId, c.input);
            actual = exec.outputs[0];
          } else {
            // 没有决策表关联的用例：用 input echo 当作 actual（占位）
            actual = { ...c.input };
          }

          const passed = c.expectedOutput
            ? JSON.stringify(sortKeys(actual)) === JSON.stringify(sortKeys(c.expectedOutput))
            : true;

          return {
            ...c,
            actualOutput: actual,
            status: passed ? 'pass' : 'fail',
            executedAt: new Date().toISOString(),
            errorMessage: passed ? undefined : `实际输出 ${JSON.stringify(actual)} 与期望 ${JSON.stringify(c.expectedOutput)} 不一致`,
          };
        } catch (err) {
          return {
            ...c,
            status: 'error',
            executedAt: new Date().toISOString(),
            errorMessage: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    // 持久化用例的最新状态
    const mergedCases = getLocalCases().map((c) => {
      const r = runResults.find((x) => x.id === c.id);
      return r ?? c;
    });
    setLocalCases(mergedCases);

    const passed = runResults.filter((r) => r.status === 'pass').length;
    const failed = runResults.filter((r) => r.status === 'fail').length;
    const errored = runResults.filter((r) => r.status === 'error').length;

    const run: TestRun = {
      id: `tr-${Date.now().toString(36)}`,
      ruleId: payload.ruleId,
      decisionTableId: payload.decisionTableId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totalCases: runResults.length,
      passedCount: passed,
      failedCount: failed,
      errorCount: errored,
      results: runResults,
    };

    setLocalRuns([run, ...getLocalRuns()].slice(0, 50));
    return run;
  }
}

/**
 * 列出最近的测试运行。
 * 后端路径：GET /v1/rule/test-runs
 */
export async function listTestRuns(ruleId?: string): Promise<TestRun[]> {
  try {
    const params = ruleId ? { ruleId } : undefined;
    const data = await get<TestRun[]>('/v1/rule/test-runs', params);
    if (data && Array.isArray(data)) {
      setLocalRuns(data);
      return data;
    }
    throw new Error('Empty test runs');
  } catch {
    const base = getLocalRuns();
    if (!ruleId) return base;
    return base.filter((r) => r.ruleId === ruleId);
  }
}

/** 对象 key 排序，便于 JSON 等值比较 */
function sortKeys(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return obj;
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
}
