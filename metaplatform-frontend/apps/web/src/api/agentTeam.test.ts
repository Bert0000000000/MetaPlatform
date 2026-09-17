// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/auth', () => ({ getToken: () => 'test-token' }));

const postMock = vi.fn();
const getMock = vi.fn();
const putMock = vi.fn();
vi.mock('./client', () => ({
  get: (...args: unknown[]) => getMock(...args),
  post: (...args: unknown[]) => postMock(...args),
  put: (...args: unknown[]) => putMock(...args),
}));

import {
  listConversationRuns,
  listProfiles,
  newIdempotencyKey,
  startRun,
  streamRunEvents,
  updateProfileRuntimes,
  type EmployeeProfile,
  type RunStep,
} from './agentTeam';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** 一块 SSE 正文。`event:` / `data:` 之间用空行分隔（服务端就是这么发的）。 */
function sse(...events: Array<{ name: string; data: unknown }>): string {
  return events
    .map((e) => `event: ${e.name}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('');
}

/** 把若干字符串分块喂进一个流（用来验"事件跨块"这个边界）。 */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function stubFetch(body: ReadableStream<Uint8Array>, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** 跑完一条流，回收到的东西（onEnd / onError 谁先到都算结束）。 */
async function drain(runId = 'r1'): Promise<{
  steps: RunStep[];
  ended: boolean;
  error: Error | null;
}> {
  const steps: RunStep[] = [];
  let ended = false;
  let error: Error | null = null;
  let resolve!: () => void;
  const finished = new Promise<void>((r) => {
    resolve = r;
  });

  streamRunEvents(runId, {
    onStep: (step) => steps.push(step),
    onEnd: () => {
      ended = true;
      resolve();
    },
    onError: (err) => {
      error = err;
      resolve();
    },
  });

  await finished;
  return { steps, ended, error };
}

describe('streamRunEvents', () => {
  it('回放 + 尾随：把 step 事件按序交出来，收到 end 就收流', async () => {
    const stepOne = {
      seq: 1,
      step: 0,
      ran: [],
      next: ['plan'],
      status: 'planning',
      at: '2026-09-17T00:00:00Z',
      evidence: [],
    };
    const stepTwo = {
      seq: 2,
      step: 1,
      ran: ['plan'],
      next: ['dispatch'],
      status: 'running',
      at: '2026-09-17T00:00:01Z',
      evidence: [{ evidenceId: 'ev-1', type: 'ONTOLOGY_OBJECT', ref: 'ont.x' }],
    };
    stubFetch(streamOf([sse({ name: 'step', data: stepOne }, { name: 'step', data: stepTwo }), sse({ name: 'end', data: {} })]));

    const { steps, ended, error } = await drain();

    expect(error).toBeNull();
    expect(ended).toBe(true);
    expect(steps.map((s) => s.seq)).toEqual([1, 2]);
    expect(steps[1].status).toBe('running');
    // 证据是**增量**：这一步新出现的条目原样带出来
    expect(steps[1].evidence).toEqual([{ evidenceId: 'ev-1', type: 'ONTOLOGY_OBJECT', ref: 'ont.x' }]);
  });

  it('事件被切在两个网络分块之间也要拼得回来', async () => {
    const payload = sse(
      { name: 'step', data: { seq: 1, step: 0, ran: [], next: [], status: 'running', at: '', evidence: [] } },
      { name: 'end', data: {} },
    );
    // 从中间切开：一半在前一块、一半在后一块
    const cut = Math.floor(payload.length / 2);
    stubFetch(streamOf([payload.slice(0, cut), payload.slice(cut)]));

    const { steps, ended } = await drain();

    expect(ended).toBe(true);
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe('running');
  });

  it('带 Authorization 头，且**不用 EventSource**（它带不了这个头）', async () => {
    // EventSource 一旦被用就会抛：本平台所有接口都要 Bearer，走它必然 401
    vi.stubGlobal(
      'EventSource',
      class {
        constructor() {
          throw new Error('不许用 EventSource');
        }
      },
    );
    const fetchMock = stubFetch(streamOf([sse({ name: 'end', data: {} })]));

    const { ended, error } = await drain('run-abc');

    expect(error).toBeNull();
    expect(ended).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/agent-team/runs/run-abc/events');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('流打不开时走 onError —— 终态不在这里，只在查询/end 里', async () => {
    stubFetch(new ReadableStream<Uint8Array>({ start: (c) => c.close() }), 404);

    const { error, ended } = await drain();

    expect(ended).toBe(false);
    expect(error?.message).toContain('404');
  });

  it('返回的停流函数能主动断开', async () => {
    // 一个永远不关闭的流：只有 abort 才能收场
    stubFetch(new ReadableStream<Uint8Array>({ start: () => undefined }));
    let ended = false;
    const stop = streamRunEvents('r1', { onEnd: () => (ended = true) });

    stop();

    expect(ended).toBe(false);
  });
});

describe('startRun', () => {
  it('走受理制：把 Idempotency-Key 带上，回执里只要地址', async () => {
    const receipt = {
      run_id: 'run-1',
      tenant_id: 'tenant-acme',
      status: 'running',
      deduplicated: false,
    };
    postMock.mockResolvedValue(receipt);

    const out = await startRun('分析本月异常订单', 3, 'key-1');

    expect(out).toEqual(receipt);
    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, timeoutMs, headers] = postMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
      number | undefined,
      Record<string, string> | undefined,
    ];
    expect(url).toBe('/agent-team/runs');
    expect(body).toMatchObject({ goal: '分析本月异常订单', max_parallel: 3 });
    expect(headers).toEqual({ 'Idempotency-Key': 'key-1' });
    // 受理制之后提交**不该**再要长超时：它立刻回
    expect(timeoutMs).toBeUndefined();
  });

  it('不给幂等键就不带这个头', async () => {
    postMock.mockResolvedValue({ run_id: 'r', tenant_id: 't', status: 'running', deduplicated: false });

    await startRun('目标');

    const [, , , headers] = postMock.mock.calls[0] as [unknown, unknown, unknown, unknown];
    expect(headers).toBeUndefined();
  });

  it('带会话 id 时把 conversation_id / turn_id 交给后端（C-1 的关系落库入口）', async () => {
    postMock.mockResolvedValue({ run_id: 'r', tenant_id: 't', status: 'running', deduplicated: false });

    await startRun('目标', 3, 'key-1', 'conv-1', 'turn-1');

    const [, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).toMatchObject({ conversation_id: 'conv-1', turn_id: 'turn-1' });
  });

  it('不给会话时**不**发空串字段 —— 空串会被后端当成"有会话"', async () => {
    postMock.mockResolvedValue({ run_id: 'r', tenant_id: 't', status: 'running', deduplicated: false });

    await startRun('目标');

    const [, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).not.toHaveProperty('conversation_id');
    expect(body).not.toHaveProperty('turn_id');
  });
});

describe('listConversationRuns', () => {
  it('按 conversation 查后端，把 items 交出来（后端是唯一关系源）', async () => {
    const items = [
      { conversation_id: 'conv-1', run_id: 'run-2', turn_id: 't2', status: 'completed', goal: 'b' },
      { conversation_id: 'conv-1', run_id: 'run-1', turn_id: 't1', status: 'failed', goal: 'a' },
    ];
    getMock.mockResolvedValue({ conversation_id: 'conv-1', items });

    const out = await listConversationRuns('conv-1');

    expect(getMock).toHaveBeenCalledWith('/agent-team/runs', { conversation: 'conv-1' });
    expect(out.map((r) => r.run_id)).toEqual(['run-2', 'run-1']); // 新→旧，原样透传
  });

  it('没有会话 id 就**不问**后端 —— 那会变成"列全租户的 run"', async () => {
    const out = await listConversationRuns('');

    expect(out).toEqual([]);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('后端没给 items 时不炸，回空数组', async () => {
    getMock.mockResolvedValue({ conversation_id: 'conv-1' });

    expect(await listConversationRuns('conv-1')).toEqual([]);
  });
});

describe('newIdempotencyKey', () => {
  it('每次都不一样 —— 不然两次提交会被当成同一轮', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
  });
});

describe('listProfiles / updateProfileRuntimes', () => {
  const base: EmployeeProfile = {
    profile_id: 'EMP-ANALYST',
    name: '数据分析师',
    base_role: 'ontology',
    system_prompt: '你是数据分析师。',
    skills: ['sk-order-anomaly'],
    tools: ['ont_object_query'],
    action_rids: ['ont.acme.action.1'],
    kb_ids: ['kb-1'],
    markings: ['internal'],
    model: 'glm-5.3-flash',
    runtimes: ['superai'],
  };

  it('列员工：交回来的是那一串 profiles', async () => {
    getMock.mockResolvedValue({ profiles: [base] });
    expect(await listProfiles()).toEqual([base]);
    expect(getMock).toHaveBeenCalledWith('/agent-team/profiles');
  });

  it('改执行面：**整份定义**回传，不能只发 runtimes', async () => {
    // 这是 PUT/upsert 不是 patch——只发 runtimes 会把提示词、技能、工具白名单、
    // 权限包络全清空。这条用例钉的就是"没漏字段"。
    putMock.mockResolvedValue({ ...base, runtimes: ['superai', 'claude_code'] });

    const saved = await updateProfileRuntimes(base, ['superai', 'claude_code']);

    expect(saved.runtimes).toEqual(['superai', 'claude_code']);
    const [url, body] = putMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/agent-team/profiles/EMP-ANALYST');
    expect(body).toMatchObject({
      profile_id: 'EMP-ANALYST',
      name: '数据分析师',
      base_role: 'ontology',
      system_prompt: '你是数据分析师。',
      skills: ['sk-order-anomaly'],
      tools: ['ont_object_query'],
      action_rids: ['ont.acme.action.1'],
      kb_ids: ['kb-1'],
      markings: ['internal'],
      model: 'glm-5.3-flash',
      runtimes: ['superai', 'claude_code'],
    });
  });

  it('老数据没有 runtimes 字段时补空数组，而不是 undefined', async () => {
    // 后端把 undefined 当"没给"→ 回落默认值，那正是"静默切换"的一种。
    // 明确发空数组，语义是"这个人一个执行面都没配"。
    const legacy = { ...base } as EmployeeProfile;
    delete legacy.runtimes;
    putMock.mockResolvedValue(base);

    await updateProfileRuntimes(legacy, []);

    const [, body] = putMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.runtimes).toEqual([]);
  });

  it('后端的拒绝原样抛出去（不许静默回落）', async () => {
    putMock.mockRejectedValue(new Error('E_INVALID_RUNTIME'));
    await expect(updateProfileRuntimes(base, ['not-a-runtime'])).rejects.toThrow('E_INVALID_RUNTIME');
  });
});
