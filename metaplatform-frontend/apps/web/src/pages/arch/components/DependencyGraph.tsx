// 应用依赖图 — Semi DOM 渲染（SemiGraphCanvas，X6 已移除）。
import { useMemo } from 'react';
import SemiGraphCanvas, { type GraphNodeSpec, type GraphEdgeSpec } from '@/components/SemiGraphCanvas';
import type { ArchApplication } from '@/api/arch/types';

interface Props {
  applications: ArchApplication[];
}

export default function DependencyGraph({ applications }: Props) {
  const { nodes, edges, worldWidth, worldHeight } = useMemo(() => {
    // 后端实际返回 id（snake_case），类型声明的 appId 可能缺省 —— 双字段回退
    const idOf = (app: ArchApplication, idx: number) =>
      app.appId ?? (app as unknown as { id?: string }).id ?? `app-${idx}`;
    const depsOf = (app: ArchApplication) =>
      (app.dependencyAppIds ?? (app as unknown as { dependency_app_ids?: string[] }).dependency_app_ids ?? []) as string[];

    const nodeWidth = 160;
    const nodeHeight = 50;
    const cols = Math.max(1, Math.ceil(Math.sqrt(applications.length)));
    const idByIndex = applications.map(idOf);
    const nodeSpecs: GraphNodeSpec[] = applications.map((app, idx) => ({
      id: idByIndex[idx],
      x: (idx % cols) * (nodeWidth + 80) + 40 + nodeWidth / 2,
      y: Math.floor(idx / cols) * (nodeHeight + 80) + 40 + nodeHeight / 2,
      w: nodeWidth, h: nodeHeight,
      label: app.name,
      color: '#52c41a',
    }));
    const edgeSpecs: GraphEdgeSpec[] = [];
    applications.forEach((app, idx) => {
      depsOf(app).forEach((depId) => {
        const srcIdx = applications.findIndex((a, j) => idByIndex[j] === depId || (a as unknown as { id?: string }).id === depId);
        if (srcIdx >= 0) {
          edgeSpecs.push({ source: idByIndex[srcIdx], target: idByIndex[idx], color: '#fa8c16', width: 2, dashed: true, label: '依赖' });
        }
      });
    });
    const rows = Math.max(1, Math.ceil(applications.length / cols));
    return {
      nodes: nodeSpecs,
      edges: edgeSpecs,
      worldWidth: cols * (nodeWidth + 80) + 40,
      worldHeight: rows * (nodeHeight + 80) + 40,
    };
  }, [applications]);

  return (
    <SemiGraphCanvas
      nodes={nodes}
      edges={edges}
      worldWidth={worldWidth}
      worldHeight={worldHeight}
      height={420}
      autoFit
      showGrid
    />
  );
}
