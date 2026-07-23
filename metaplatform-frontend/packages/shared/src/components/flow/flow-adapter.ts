/**
 * FlowCanvas 适配器
 * --------------------------------------------------
 * 业务模型 <-> FlowGram.AI fixed-layout JSON 双向转换。
 *
 * FlowGram 1.0.12 fixed-layout JSON 结构（简化）：
 * {
 *   nodes: [
 *     {
 *       id: string,
 *       type: string,            // 节点类型（custom 自定义需对应 FlowNodeRegistry.type）
 *       meta: { position: { x, y } },
 *       data: { title, content, ... },  // 表单数据
 *       style: { width?, height?, ... }
 *     }
 *   ],
 *   edges: [
 *     {
 *       id: string,
 *       sourceNodeID: string,
 *       targetNodeID: string,
 *       sourcePortID?: string,
 *       targetPortID?: string,
 *       text?: string,
 *       data?: unknown
 *     }
 *   ]
 * }
 */

import type { FlowData, FlowEdge, FlowNode } from './flow-types';

export interface FlowGramNodeJSON {
  id: string;
  type: string;
  meta?: { position?: { x: number; y: number } };
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
  blocks?: unknown[];
}

export interface FlowGramEdgeJSON {
  id: string;
  sourceNodeID: string;
  targetNodeID: string;
  sourcePortID?: string;
  targetPortID?: string;
  text?: string;
  data?: Record<string, unknown>;
}

export interface FlowGramDocumentJSON {
  nodes: FlowGramNodeJSON[];
  edges: FlowGramEdgeJSON[];
}

/**
 * 业务模型 → FlowGram JSON
 */
export function flowDataToFlowgram(data: FlowData): FlowGramDocumentJSON {
  const nodes: FlowGramNodeJSON[] = data.nodes.map((node: FlowNode) => ({
    id: node.id,
    type: node.type,
    meta: {
      position: { x: node.x, y: node.y },
    },
    data: {
      title: node.name,
      ...(node.data ?? {}),
    },
    style:
      node.width !== undefined || node.height !== undefined
        ? { width: node.width, height: node.height }
        : undefined,
  }));

  const edges: FlowGramEdgeJSON[] = data.edges.map((edge: FlowEdge) => ({
    id: edge.id,
    sourceNodeID: edge.source,
    targetNodeID: edge.target,
    sourcePortID: edge.sourcePort,
    targetPortID: edge.targetPort,
    text: edge.label,
    data: edge.data ? (edge.data as Record<string, unknown>) : undefined,
  }));

  return { nodes, edges };
}

/**
 * FlowGram JSON → 业务模型
 */
export function flowgramToFlowData(json: FlowGramDocumentJSON): FlowData {
  const nodes: FlowNode[] = (json.nodes ?? []).map((n) => {
    const title = (n.data?.title as string | undefined) ?? '';
    const { title: _, ...rest } = (n.data ?? {}) as Record<string, unknown>;
    return {
      id: n.id,
      type: n.type,
      name: title,
      x: n.meta?.position?.x ?? 0,
      y: n.meta?.position?.y ?? 0,
      width: n.style?.width as number | undefined,
      height: n.style?.height as number | undefined,
      data: Object.keys(rest).length > 0 ? rest : undefined,
    };
  });

  const edges: FlowEdge[] = (json.edges ?? []).map((e) => ({
    id: e.id,
    source: e.sourceNodeID,
    target: e.targetNodeID,
    sourcePort: e.sourcePortID,
    targetPort: e.targetPortID,
    label: e.text,
    data: e.data,
  }));

  return { nodes, edges };
}
