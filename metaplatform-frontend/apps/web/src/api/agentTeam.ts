import { get, post } from './client';
import { getToken } from '@/utils/auth';
import type { Evidence } from './superai/types';

/**
 * Agent 产品层 —— 超级大脑 + 数字员工。
 *
 * 契约：mate-platform-backend/contracts/openapi/services/agent-team.yaml
 * 服务：mate-tech-agent-team（/api/v1/agent-team/*）
 *
 * 本页只做**读**：提交一句话、看任务图与各员工状态、翻证据与交付物、点一次
 * 人工确认。不写任何前端本地拼装——没拿到就是没拿到。
 *
 * 证据的类型直接用 SuperAI 那一套 `Evidence`（见 `api/superai/types`）：
 * agent-team 产出的是**同一种形状**的条目，前端因此只认一套字段、只用一个
 * 渲染组件。
 */

export interface SubTask {
  task_id: string;
  profile_id: string;
  instruction: string;
  depends_on: string[];
}

/** 一件可寻址的产出物（元数据）。正文走 `GET /artifacts/{id}` 另取。 */
export interface Artifact {
  artifact_id: string;
  run_id: string;
  task_id: string;
  profile_id: string;
  /** 产出物种类（当前只有 report）。 */
  kind: string;
  title: string;
  content_type: string;
  /** 正文的字节数。 */
  size: number;
  created_at: string;
}

export interface ArtifactContent extends Artifact {
  content: string;
}

export interface SubTaskResult {
  task_id: string;
  team_task_id: string;
  profile_id: string;
  status: 'ok' | 'error' | 'rejected';
  output: string;
  tool_calls: Array<Record<string, unknown>>;
  llm_calls: number;
  source: string;
  error: string;
  /** 可判定的失败类别（越权待授权 / 硬拒 / 重试用尽）。 */
  error_code: string;
  /** 越权时的人审提案。 */
  proposal: Record<string, unknown>;
  /** 真正发起的运行时调用次数（含重试）。 */
  attempts: number;
  /** 该员工工具调用结果映射出的结构化证据。 */
  evidence: Evidence[];
  /** 该员工产出的可寻址交付物（元数据）。 */
  artifacts: Artifact[];
}

export type RunStatus =
  | 'planning'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface RunState {
  run_id: string;
  tenant_id: string;
  goal: string;
  status: RunStatus;
  subtasks: SubTask[];
  results: Record<string, SubTaskResult>;
  summary: string;
  hitl_reason: string;
  error: string;
  /** 本轮实际生效的运行级超时（秒；0 = 不设超时）。 */
  timeout_seconds: number;
  /** 本轮截止的绝对时刻（epoch 秒；0 = 无截止）。 */
  deadline_at: number;
}

/**
 * 一轮运行的接口是**受理制**（1.7 任务 1）：`POST /runs` 立刻回 `202` + run_id，
 * 不等人拆图派活跑完（那实测是分钟级，远超默认 30s，也正是 1.6 那个
 * "504 了但 run 其实已建好、重试多跑一轮"的根因）。终态只能从 `GET /runs/{id}`
 * 或事件流取。
 *
 * 剩下两个端点仍然是**同步长跑**：approve 要等续跑跑完，cancel 要等图在节点
 * 边界停下（1.5 任务 1）。给它们单独放宽，不动全局默认值。
 */
const RUN_TIMEOUT_MS = 300_000;

/**
 * 受理回执（`POST /runs` 的 202 响应）。**不含运行结果**——任务图、员工状态、
 * 证据、交付物一律从 `GET /runs/{id}` 取。
 */
export interface RunAccepted {
  run_id: string;
  tenant_id: string;
  /** 受理那一刻的状态，通常是 `running`；**不是终态**。 */
  status: RunStatus;
  /** 这次提交是否**没有新起一轮**（同一个 Idempotency-Key 的重复提交）。 */
  deduplicated: boolean;
}

/** 事件流里的一步（`event: step` 的 data）。 */
export interface RunStep {
  seq: number;
  step: number;
  /** 这一步真的跑掉的节点。 */
  ran: string[];
  /** 接下来要跑谁。 */
  next: string[];
  status: string;
  at: string;
  /** 这一步**新出现的**证据条目（增量，按 evidenceId 去重后 append 即可）。 */
  evidence: Evidence[];
}

/**
 * 生成一次提交的幂等键。带它提交时，同一个键（同租户内）永远映射到同一轮运行
 * ——网络层重试/超时重发不会多跑一轮。
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function startRun(
  goal: string,
  maxParallel = 3,
  idempotencyKey?: string,
  conversationId?: string,
  turnId?: string,
): Promise<RunAccepted> {
  // 受理制之后这里不再需要长超时：请求立刻回，拆图与派活在后台跑。
  //
  // `conversation_id` 是 **C-1 那条关系的落库入口**：给了它就由后端记住"这一轮
  // 属于哪次会话"。不给只是不起这层关系（工作台直接起一轮、脚本），不是错误。
  return post<RunAccepted>(
    '/agent-team/runs',
    {
      goal,
      max_parallel: maxParallel,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(turnId ? { turn_id: turnId } : {}),
    },
    undefined,
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  );
}

/**
 * 一个会话里的一轮 run（`GET /runs?conversation=` 的一项）。
 *
 * `status` / `goal` 来自该轮**自己的检查点**（与 `GET /runs/{id}` 同一份事实），
 * 不是后端另存的一份状态——所以列表与详情不会各说各话。
 */
export interface ConversationRun {
  conversation_id: string;
  run_id: string;
  turn_id: string;
  created_by: string;
  relation_type: string;
  created_at: string;
  /** 该轮此刻的状态；已受理但还没落第一个检查点时为空串。 */
  status: string;
  goal: string;
}

/**
 * 列一个会话里的各轮 run（**新→旧**）。
 *
 * **后端是唯一关系源**（C-1）。这条关系以前只写在 localStorage——换个机器、
 * 清一次缓存就没了。本地那份现在只是**缓存**：用它先画一帧，真值以这里为准。
 */
export async function listConversationRuns(conversationId: string): Promise<ConversationRun[]> {
  if (!conversationId) return [];
  const body = await get<{ conversation_id: string; items: ConversationRun[] }>(
    '/agent-team/runs',
    { conversation: conversationId },
  );
  return body.items ?? [];
}

export async function getRun(runId: string): Promise<RunState> {
  return get<RunState>(`/agent-team/runs/${runId}`);
}

export async function approveRun(runId: string, approved = true): Promise<RunState> {
  return post<RunState>(`/agent-team/runs/${runId}/approve`, { approved }, RUN_TIMEOUT_MS);
}

export async function cancelRun(runId: string): Promise<RunState> {
  // 取消会**等图在节点边界停下**再回话（1.5 任务 1），同样不是瞬时返回。
  return post<RunState>(`/agent-team/runs/${runId}/cancel`, {}, RUN_TIMEOUT_MS);
}

export interface RunEventCallbacks {
  /** 流连上了（回放开始之前）。 */
  onOpen?: () => void;
  /** 收到一步。 */
  onStep?: (step: RunStep) => void;
  /** 收流：run 已经落终态，服务端发了 `event: end`。 */
  onEnd?: () => void;
  /** 流断了 / 打不开。**终态不在这里**——它只在 `end` 或查询里。 */
  onError?: (err: Error) => void;
}

/**
 * 订阅一轮运行的步骤级事件流（SSE：先回放历史，再尾随新步骤，终态才收流）。
 *
 * **不用 `EventSource`**：它带不了 `Authorization` 头（本平台所有接口都要 Bearer），
 * 用 URL 传令牌又会把令牌写进日志/历史。所以走 `fetch` + `ReadableStream`——
 * 与 `streamDelegation`（A2A 那条流）同一套做法。
 *
 * 配套 `GET /runs/{id}`：**流负责说"有推进了"，查询负责给"现在长什么样"**。
 * 流的 payload 只有这一步的增量（谁跑了、什么状态、新增了哪些证据），任务图与
 * 交付物在回执里——两处各攒一份状态必然对不上。
 *
 * 返回一个**停流函数**（组件卸载时调）。服务端在 run 落终态时自己发 `end` 收流；
 * 停在 `awaiting_approval` 的运行**不会**自己关流，那条流会一直守着，人工确认之后
 * 的推进继续从同一条流到达。
 */
export function streamRunEvents(runId: string, callbacks: RunEventCallbacks): () => void {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const controller = new AbortController();
  const token = getToken();

  fetch(`${baseUrl}/agent-team/runs/${runId}/events`, {
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } as Record<string, string>,
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        callbacks.onError?.(new Error(`事件流打不开（HTTP ${response.status}）`));
        return;
      }
      if (!response.body) {
        callbacks.onError?.(new Error('事件流没有响应体'));
        return;
      }
      callbacks.onOpen?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventName = '';
      let eventData = '';

      const flush = () => {
        const name = eventName;
        const data = eventData;
        eventName = '';
        eventData = '';
        if (name === 'step') {
          try {
            callbacks.onStep?.(JSON.parse(data) as RunStep);
          } catch {
            // 单条事件坏了不该把整条流带停
          }
        } else if (name === 'end') {
          callbacks.onEnd?.();
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // 服务端只发 \n\n；把可能的 \r\n 归一化，免得 CRLF 代理把事件切错。
          buffer = buffer.replace(/\r\n/g, '\n');
          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) eventData += line.slice(5).trim();
            }
            flush();
            boundary = buffer.indexOf('\n\n');
          }
        }
        flush();
      } catch (err) {
        // 主动停流（组件卸载）不算错误
        if (!controller.signal.aborted) {
          callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })
    .catch((err: unknown) => {
      if (!controller.signal.aborted) {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    });

  return () => controller.abort();
}

/** 一轮运行的全部产出物（元数据；正文按 id 另取）。 */
export async function listRunArtifacts(runId: string): Promise<Artifact[]> {
  const page = await get<{ items: Artifact[] }>(`/agent-team/runs/${runId}/artifacts`);
  return page.items ?? [];
}

/** 按 id 取回产出物正文——"可寻址、可取回"的取回那半边。 */
export async function getArtifact(artifactId: string): Promise<ArtifactContent> {
  return get<ArtifactContent>(`/agent-team/artifacts/${artifactId}`);
}
