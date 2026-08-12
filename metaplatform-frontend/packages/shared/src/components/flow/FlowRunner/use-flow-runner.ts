/**
 * useFlowRunner —— 纯前端流程执行模拟（支持并行 / 条件容器节点）
 * --------------------------------------------------
 * 从 FlowGramDocumentJSON 递归构建节点表（顶层 nodes + 复合节点 blocks 嵌套），
 * 用"执行队列"推进：
 *  - 自动节点（bpmnStart / business_* / agent_* / bpmnEnd）：延迟后完成
 *  - 容器节点（condition / loop / multiOutputs / multiInputs / tryCatch / block）：
 *    完成后把每个分支块的首节点 + edges 出边加入队列 → 并行分支逐条执行
 *  - agent_if：按 data.branch 匹配带 label 的出边
 *  - bpmnUserTask：暂停到 approval_waiting，等待 resolveApproval（模拟 Flowable 审批）
 *  - hitl_confirm：暂停到 hitl_waiting，等待 resolveHitl（模拟自建 HITL proposal/token 确认）
 *  - 驳回 / 拒绝：节点标 rejected，流程结束
 */
import { useRef, useState } from 'react';
import type { FlowGramDocumentJSON } from '../flow-adapter';
import type { ExecState, RunnerApi, RunnerLog, RunnerStatus } from './flow-runner-types';

interface GNode {
  id: string;
  type: unknown;
  data?: Record<string, unknown>;
  /** 复合节点：嵌套的分支块 id 列表 */
  blocks: string[];
}

let uid = 0;
function nextId(): string {
  uid += 1;
  return `fr-l-${uid}`;
}

const MANUAL_TYPES = new Set(['hitl_confirm', 'bpmnUserTask']);
const END_TYPES = new Set(['bpmnEnd', 'end']);

export function useFlowRunner(docRef: { current: FlowGramDocumentJSON }): RunnerApi {
  const [stateMap, setStateMap] = useState<Record<string, ExecState>>({});
  const [logs, setLogs] = useState<RunnerLog[]>([]);
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [stepDelay, setStepDelayState] = useState(600);

  const stepDelayRef = useRef(stepDelay);
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const stateMapRef = useRef<Record<string, ExecState>>({});
  const queueRef = useRef<string[]>([]);
  const visitedRef = useRef<Set<string>>(new Set());
  const nodesRef = useRef<Map<string, GNode>>(new Map());
  const adjRef = useRef<Map<string, { id: string; label?: string }[]>>(new Map());
  const inDegreeRef = useRef<Map<string, number>>(new Map());

  const setStatusAll = (s: RunnerStatus) => {
    setStatus(s);
  };

  const addLog = (e: { nodeId: string; nodeTitle: string; event: string; detail?: string }) => {
    setLogs((l) =>
      [
        ...l,
        {
          id: nextId(),
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          ...e,
        },
      ].slice(-300)
    );
  };

  const setNodeState = (id: string, s: ExecState) => {
    stateMapRef.current = { ...stateMapRef.current, [id]: s };
    setStateMap(stateMapRef.current);
  };

  const hasManualWaiting = () =>
    Object.values(stateMapRef.current).some(
      (s) => s === 'hitl_waiting' || s === 'approval_waiting'
    );

  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const sleepWhilePaused = async () => {
    while (pausedRef.current && !cancelledRef.current) {
      await delay(80);
    }
  };

  // 递归收集顶层 nodes + 复合节点 blocks 内的所有节点
  const collectNode = (id: string, type: unknown, data: Record<string, unknown> | undefined, blocks: unknown[] | undefined) => {
    const blockIds: string[] = [];
    for (const b of blocks ?? []) {
      const block = b as {
        id: string;
        type?: unknown;
        data?: Record<string, unknown>;
        blocks?: unknown[];
      };
      if (!block?.id) continue;
      blockIds.push(block.id);
      collectNode(block.id, block.type, block.data, block.blocks);
    }
    nodesRef.current.set(id, { id, type, data, blocks: blockIds });
    inDegreeRef.current.set(id, 0);
  };

  const buildGraph = () => {
    nodesRef.current = new Map();
    adjRef.current = new Map();
    inDegreeRef.current = new Map();
    for (const n of docRef.current.nodes ?? []) {
      collectNode(n.id, n.type, (n.data ?? {}) as Record<string, unknown>, n.blocks);
    }
    // 为所有已知节点初始化出边表
    for (const id of nodesRef.current.keys()) adjRef.current.set(id, []);
    for (const e of docRef.current.edges ?? []) {
      adjRef.current.get(e.sourceNodeID)?.push({ id: e.targetNodeID, label: e.text });
      inDegreeRef.current.set(
        e.targetNodeID,
        (inDegreeRef.current.get(e.targetNodeID) ?? 0) + 1
      );
    }
  };

  const findEntry = (): string | null => {
    const candidates = [...nodesRef.current.keys()].filter(
      (id) => (inDegreeRef.current.get(id) ?? 0) === 0 && nodesRef.current.get(id)?.blocks.length === 0
    );
    const pref = ['bpmnStart', 'agent_input', 'business_trigger', 'start', 'input'];
    return (
      pref
        .map((t) => candidates.find((id) => String(nodesRef.current.get(id)?.type) === t))
        .find(Boolean) ?? candidates[0] ?? null
    );
  };

  // 后继节点：复合节点展开 blocks 分支首节点 + edges 出边；普通节点只走 edges
  const nextNodes = (id: string): string[] => {
    const node = nodesRef.current.get(id);
    if (!node) return [];
    const result: string[] = [];
    // 复合容器：展开每个分支块（block 容器取其内嵌首节点）
    for (const bId of node.blocks) {
      const branch = nodesRef.current.get(bId);
      if (branch && branch.blocks.length > 0) result.push(branch.blocks[0]);
      else result.push(bId);
    }
    // edges 出边：agent_if 按 data.branch 匹配 label，其余取全部
    const outs = adjRef.current.get(id) ?? [];
    const type = String(node.type);
    if (type === 'agent_if') {
      const branch = String(node.data?.branch ?? 'high');
      const hit = outs.find((o) => o.label === branch);
      if (hit) result.push(hit.id);
      else if (outs.length > 0) result.push(outs[0].id);
    } else {
      for (const o of outs) result.push(o.id);
    }
    return result;
  };

  const finish = () => {
    setStatusAll('finished');
    addLog({ nodeId: '', nodeTitle: '', event: 'finish', detail: '流程执行结束' });
  };

  const executeNode = async (id: string) => {
    if (visitedRef.current.has(id)) return;
    visitedRef.current.add(id);
    const node = nodesRef.current.get(id);
    if (!node) return;
    const type = String(node.type);
    const title = String(node.data?.title ?? id);

    if (type === 'hitl_confirm') {
      setNodeState(id, 'hitl_waiting');
      addLog({ nodeId: id, nodeTitle: title, event: 'hitl', detail: '等待人工确认 (HITL)' });
      return;
    }
    if (type === 'bpmnUserTask') {
      setNodeState(id, 'approval_waiting');
      addLog({ nodeId: id, nodeTitle: title, event: 'approval', detail: '等待审批 (Flowable)' });
      return;
    }

    setNodeState(id, 'running');
    addLog({ nodeId: id, nodeTitle: title, event: 'enter', detail: `执行节点 ${type}` });
    await delay(stepDelayRef.current);
    if (cancelledRef.current) return;
    setNodeState(id, 'completed');
    addLog({ nodeId: id, nodeTitle: title, event: 'complete' });

    if (END_TYPES.has(type)) {
      finish();
      return;
    }

    for (const nid of nextNodes(id)) {
      if (!visitedRef.current.has(nid)) queueRef.current.push(nid);
    }
  };

  const pump = async () => {
    while (queueRef.current.length > 0 && !cancelledRef.current) {
      await sleepWhilePaused();
      if (cancelledRef.current) return;
      const id = queueRef.current.shift();
      if (id) await executeNode(id);
    }
    if (!cancelledRef.current && !hasManualWaiting()) {
      setStatusAll('finished');
    }
  };

  const run = () => {
    if (runningRef.current) return;
    cancelledRef.current = false;
    pausedRef.current = false;
    buildGraph();
    stateMapRef.current = {};
    setStateMap({});
    setLogs([]);
    visitedRef.current = new Set();
    queueRef.current = [];
    const entry = findEntry();
    if (!entry) {
      addLog({ nodeId: '', nodeTitle: '', event: 'error', detail: '未找到流程入口节点' });
      return;
    }
    setStatusAll('running');
    runningRef.current = true;
    addLog({
      nodeId: entry,
      nodeTitle: String(nodesRef.current.get(entry)?.data?.title ?? entry),
      event: 'enter',
      detail: '流程启动',
    });
    queueRef.current.push(entry);
    void pump().finally(() => {
      runningRef.current = false;
    });
  };

  const pause = () => {
    pausedRef.current = true;
    setStatusAll('paused');
    addLog({ nodeId: '', nodeTitle: '', event: 'pause', detail: '已暂停' });
  };

  const resume = () => {
    pausedRef.current = false;
    setStatusAll('running');
    addLog({ nodeId: '', nodeTitle: '', event: 'resume', detail: '继续执行' });
  };

  const reset = () => {
    cancelledRef.current = true;
    pausedRef.current = false;
    runningRef.current = false;
    stateMapRef.current = {};
    setStateMap({});
    setLogs([]);
    visitedRef.current = new Set();
    queueRef.current = [];
    setStatusAll('idle');
  };

  const resolveManual = (nodeId: string, approved: boolean, kind: 'hitl' | 'approval') => {
    if (cancelledRef.current) return;
    const node = nodesRef.current.get(nodeId);
    const title = String(node?.data?.title ?? nodeId);
    if (!approved) {
      setNodeState(nodeId, 'rejected');
      addLog({
        nodeId,
        nodeTitle: title,
        event: 'reject',
        detail: kind === 'hitl' ? '人工拒绝提案，流程终止' : '审批驳回，流程终止',
      });
      finish();
      return;
    }
    setNodeState(nodeId, 'completed');
    addLog({
      nodeId,
      nodeTitle: title,
      event: 'complete',
      detail: kind === 'hitl' ? '人工确认 (HITL token 校验通过)' : '审批通过',
    });
    for (const nid of nextNodes(nodeId)) {
      if (!visitedRef.current.has(nid)) queueRef.current.push(nid);
    }
    void pump();
  };

  const resolveHitl = (nodeId: string, approved: boolean) => resolveManual(nodeId, approved, 'hitl');
  const resolveApproval = (nodeId: string, approved: boolean) =>
    resolveManual(nodeId, approved, 'approval');

  const setStepDelay = (d: number) => {
    stepDelayRef.current = d;
    setStepDelayState(d);
  };

  return {
    stateMap,
    logs,
    status,
    stepDelay,
    setStepDelay,
    run,
    pause,
    resume,
    reset,
    resolveHitl,
    resolveApproval,
  };
}
