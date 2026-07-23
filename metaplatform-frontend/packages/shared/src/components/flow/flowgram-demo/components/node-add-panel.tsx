/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 用 lucide-react 自渲染 chips，并保留官方 useStartDragNode 拖拽创建节点能力。
 */
import React from 'react';
import { nanoid } from 'nanoid';
import { useStartDragNode } from '@flowgram.ai/fixed-layout-editor';
import type { FlowNodeRegistry } from '@flowgram.ai/fixed-layout-editor';
import { useAddNode } from '../hooks/use-add-node';
import { getNodeTypeLabel } from '../../node-label-zh';
import {
  type LucideIcon,
  ArrowRight,
  CheckCircle2,
  Circle,
  Bot,
  Cpu,
  Database,
  Filter,
  FunctionSquare,
  GitBranch,
  PlayCircle,
  Sparkles,
  SquareDashed,
  Wand2,
  Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  start: PlayCircle,
  end: CheckCircle2,
  condition: GitBranch,
  branch: GitBranch,
  custom: SquareDashed,
  break: Filter,
  loop: FunctionSquare,
  multiInputs: ArrowRight,
  multiOutputs: ArrowRight,
  tryCatch: Wand2,
  slot: Sparkles,
  // Mate domain nodes
  bpmnStart: PlayCircle,
  bpmnEnd: CheckCircle2,
  bpmnUserTask: Circle,
  bpmnService: Cpu,
  bpmnGateway: GitBranch,
  agent_input: Database,
  agent_output: Database,
  agent_llm: Sparkles,
  agent_tool: Zap,
  agent_knowledge: Bot,
  agent_if: Filter,
  agent_loop: FunctionSquare,
  agent_branch: GitBranch,
};

interface NodeAddPanelProps {
  /**
   * 业务侧提供的节点表，按 category 分组。默认用 mate 自带的 BPMN / Agent 节点集。
   */
  categories?: Array<{
    key: string;
    label: string;
    registries: FlowNodeRegistry[];
  }>;
}

export const NodeAddPanel: React.FC<NodeAddPanelProps> = ({ categories }) => {
  const { startDrag } = useStartDragNode();
  const { handleAdd, handleAddBranch } = useAddNode();

  const groups: NonNullable<NodeAddPanelProps['categories']> =
    categories && categories.length > 0 ? categories : [];

  return (
    <div className="demo-fixed-sidebar">
      {groups.map((group) => (
        <div key={group.key} className="fg-node-group">
          <div className="fg-node-group-title">{group.label}</div>
          {group.registries.map((registry) => {
            const Icon = ICON_MAP[registry.type] ?? Circle;
            return (
              <div
                key={`${group.key}-${registry.type}`}
                className="fg-node-card"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const nodeAddData = registry.onAdd();
                  void startDrag(
                    e,
                    {
                      dragJSON: nodeAddData,
                      onCreateNode: async (json, dropNode) => handleAdd(json, dropNode),
                    },
                    { disableDragScroll: true }
                  );
                }}
              >
                <span className="fg-node-card-icon">
                  <Icon size={16} />
                </span>
                <span className="fg-node-card-name">{getNodeTypeLabel(registry.type)}</span>
              </div>
            );
          })}
        </div>
      ))}
      <div
        key="branch"
        className="fg-node-card"
        onMouseDown={(e) => {
          e.stopPropagation();
          void startDrag(
            e,
            {
              dragJSON: {
                id: `branch_${nanoid(5)}`,
                type: 'block',
                data: { title: 'New Branch' },
              },
              isBranch: true,
              onCreateNode: async (json, dropNode) => handleAddBranch(json, dropNode),
            },
            { disableDragScroll: true }
          );
        }}
      >
        <span className="fg-node-card-icon">
          <GitBranch size={16} />
        </span>
        <span className="fg-node-card-name">{getNodeTypeLabel('branch')}</span>
      </div>
    </div>
  );
};

export default NodeAddPanel;
