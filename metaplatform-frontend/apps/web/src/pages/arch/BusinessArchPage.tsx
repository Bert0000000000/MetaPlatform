import React, { useEffect, useMemo, useState } from 'react';
import {
  Radio,
  Input,
  Tree,
  Typography,
  Tag,
  Space,
  Card,
  Spin,
  Button,
  SideSheet,
  Descriptions,
} from '@douyinfe/semi-ui';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  ShareAltOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  FreeLayoutEditorProvider,
  EditorRenderer,
  useNodeRender,
  type WorkflowJSON,
  type WorkflowNodeRegistry,
} from '@flowgram.ai/free-layout-editor';
import '@flowgram.ai/free-layout-editor/index.css';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree/interface';
import type { Capability } from '@/api/arch/types';
import { getCapabilityTree } from '@/api/arch/capabilities';

const { Text } = Typography;

type ViewMode = 'keyboard' | 'capability-map';

const VIEW_OPTIONS = [
  { value: 'keyboard', label: '键盘图' },
  { value: 'capability-map', label: '能力地图' },
] as const;

type LevelFilter = 'all' | '1' | '2' | '3';

const LEVEL_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: '1', label: 'L1' },
  { value: '2', label: 'L2' },
  { value: '3', label: 'L3' },
] as const;

/** L1-L3 节点的视觉尺寸：
 *  - L1：横跨整行的横条（高度较低，宽 1280）
 *  - L2：横排方块（240×56）
 *  - L3：纵列方块（160×32）
 */
const NODE_SIZE = (level: number) => ({
  width: level === 1 ? 1280 : level === 2 ? 240 : level === 3 ? 160 : 200,
  height: level === 1 ? 40 : level === 2 ? 56 : level === 3 ? 32 : 56,
});

/** 节点间距 */
const NODE_GAP_X = 16;
const NODE_GAP_Y = 16;

/**
 * 把 Capability[] 展平为带坐标的节点 + edges。
 *
 * 布局策略（参考键盘图风格）：
 *  - L1 横向铺满一行（每行一个 L1，多个 L1 纵向堆叠）
 *  - L2 在所属 L1 下方横向铺开（一行多列）
 *  - L3 在所属 L2 下方纵向堆叠（每行一个 L3）
 */
function buildKeyboardLayout(
  caps: Capability[],
  overrides: Record<string, { x: number; y: number }> = {},
): {
  nodes: Array<{ id: string; type: string; data: { level: number; name: string; code: string }; meta: { position: { x: number; y: number } } }>;
  edges: Array<{ sourceNodeID: string; targetNodeID: string }>;
} {
  const nodes: ReturnType<typeof buildKeyboardLayout>['nodes'] = [];
  const edges: ReturnType<typeof buildKeyboardLayout>['edges'] = [];

  /** 计算从某个节点开始的「子树最大底部 y 偏移（含自身 + 子树）」 */
  const subtreeBottomOffset = (c: Capability, depth: number): number => {
    const h = NODE_SIZE(c.level).height;
    if (depth >= 3 || !c.children || c.children.length === 0) return h;
    // L1 下挂 L2 横排，rowBottom = max(l2.bottom)
    if (c.level === 1) {
      const childTop = h + NODE_GAP_Y;
      let maxChildBottom = childTop + NODE_SIZE(2).height;
      for (const l2 of c.children) {
        const l2Bottom = childTop + NODE_SIZE(2).height;
        let maxL3Bottom = l2Bottom;
        for (const l3 of l2.children ?? []) {
          maxL3Bottom = Math.max(maxL3Bottom, childTop + NODE_SIZE(2).height + NODE_GAP_Y + subtreeBottomOffset(l3, depth + 1));
        }
        maxChildBottom = Math.max(maxChildBottom, maxL3Bottom);
      }
      return maxChildBottom;
    }
    // L2 下挂 L3 纵列
    if (c.level === 2) {
      let cursor = h + NODE_GAP_Y;
      let maxBottom = h;
      for (const l3 of c.children) {
        maxBottom = Math.max(maxBottom, cursor + NODE_SIZE(3).height);
        cursor += NODE_SIZE(3).height + NODE_GAP_Y;
      }
      return maxBottom;
    }
    return h;
  };

  const draw = (c: Capability, parentId: string | null, x: number, y: number): void => {
    const id = c.capabilityId;
    const pos = overrides[id] ?? { x, y };
    nodes.push({
      id,
      type: 'capability',
      data: { level: c.level, name: c.name, code: c.code ?? '' },
      meta: { position: pos },
    });
    if (parentId) edges.push({ sourceNodeID: parentId, targetNodeID: id });

    const h = NODE_SIZE(c.level).height;
    // 用了 override 后子节点仍按自动布局算（在 L1/L2 下原坐标位置上），
    // 因为用户调整的是单一节点的相对位置。
    if (c.level === 1) {
      const l2Y = y + h + NODE_GAP_Y;
      let l2X = x;
      for (const l2 of c.children ?? []) {
        draw(l2, id, l2X, l2Y);
        l2X += NODE_SIZE(2).width + NODE_GAP_X;
      }
    } else if (c.level === 2) {
      const l3X = x;
      let l3Y = y + h + NODE_GAP_Y;
      for (const l3 of c.children ?? []) {
        draw(l3, id, l3X, l3Y);
        l3Y += NODE_SIZE(3).height + NODE_GAP_Y;
      }
    }
  };

  // 多个 L1 各自占一行
  let y = 0;
  for (const c of caps) {
    draw(c, null, 0, y);
    y += subtreeBottomOffset(c, 1) + NODE_GAP_Y * 2;
  }

  return { nodes, edges };
}

/**
 * 业务架构总览（键盘图 + 能力地图双视图）。
 *
 * 布局：
 * ┌──────────────────────────────────────────────────────────┐
 * │ 顶部：SegmentedControl 视图切换（键盘图 / 能力地图）       │
 * ├──────────────┬───────────────────────────┬────────────────┤
 * │  L1-L3 树     │  当前节点缩略图 / 详情     │ 流程体系框架    │
 * │  （搜索+列表）│  （键盘图模式）            │ Operating/...  │
 * └──────────────┴───────────────────────────┴────────────────┘
 *
 * 「能力地图」模式：左侧保留 L1-L3 树，中间展示能力详情与关联入口，
 * 右侧隐藏框架三组（避免与键盘图重复），左侧宽度自适应加宽。
 *
 * 数据源：getCapabilityTree（L1-L3 层级能力树），缺失时回退到本地 mock。
 */
export default function BusinessArchPage() {
  const [capabilities, setCapabilities] = useState<Capability[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | undefined>();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('keyboard');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  /** 键盘图内部「预览」/「编辑」模式：默认预览（显示静态缩略图），点击「编辑」进入 flowgram 画布 */
  const [keyboardEditMode, setKeyboardEditMode] = useState(false);
  /** 键盘图编辑模式下点击节点弹出的 Drawer */
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCapabilityTree()
      .then((caps) => {
        if (cancelled) return;
        const data = Array.isArray(caps) && caps.length > 0 ? caps : FALLBACK_CAPS;
        setCapabilities(data);
        rebuildNodeData(data);
      })
      .catch(() => {
        if (cancelled) return;
        setCapabilities(FALLBACK_CAPS);
        rebuildNodeData(FALLBACK_CAPS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 构建 Semi Tree 的 data
  const treeData = useMemo<TreeNodeData[]>(() => buildTreeData(capabilities ?? [], keyword), [capabilities, keyword]);

  // 默认展开 L1
  useEffect(() => {
    if (capabilities && capabilities.length > 0) {
      setExpandedKeys((prev) => (prev.length === 0 ? capabilities.map((c) => c.capabilityId) : prev));
      setActiveKey((prev) => prev ?? capabilities[0].capabilityId);
    }
  }, [capabilities]);

  const activeNode = useMemo(() => findNodeByKey(capabilities ?? [], activeKey), [capabilities, activeKey]);

  // 能力地图模式：左侧树更宽
  const gridTemplateColumns = viewMode === 'keyboard' ? '300px 1fr' : '340px 1fr';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* 顶部控件栏：视图切换 + 层级过滤（仅键盘图显示） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        <Radio.Group
          type="button"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          options={VIEW_OPTIONS as unknown as Array<{ value: string; label: string }>}
        />
        {viewMode === 'keyboard' && keyboardEditMode && (
          <Space align="center" spacing={8}>
            <Text type="secondary" style={{ fontSize: 13 }}>层级过滤</Text>
            <Radio.Group
              type="button"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
              options={LEVEL_OPTIONS as unknown as Array<{ value: string; label: string }>}
            />
          </Space>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns, gap: 12 }}>
        {/* ============ 左侧：L1-L3 树（两种视图共用） ============ */}
        <Card
          title={
            <Space>
              <ApartmentOutlined />
              <span>{viewMode === 'keyboard' ? '流程体系' : '能力地图'}</span>
            </Space>
          }
          bodyStyle={{ padding: 12, height: 'calc(100% - 49px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <Input
            placeholder="请输入内容"
            value={keyword}
            onChange={(v) => setKeyword(v)}
            showClear
            style={{ marginBottom: 10 }}
          />
          <Spin spinning={capabilities === null} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Tree
              treeData={treeData}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys as string[])}
              defaultExpandAll={false}
              onSelect={(key) => setActiveKey(typeof key === 'string' ? key : String(key))}
              showLine
            />
          </Spin>
        </Card>

        {/* ============ 中间：键盘图预览/编辑 / 能力地图详情 ============ */}
        <Card
          title={
            <Space>
              {viewMode === 'keyboard' ? (
                <>
                  <span>流程体系框架</span>
                  {activeNode && (
                    <Tag size="small" color={activeNode.level === 1 ? 'blue' : activeNode.level === 2 ? 'green' : 'orange'}>
                      L{activeNode.level}
                    </Tag>
                  )}
                </>
              ) : (
                <>
                  <AppstoreOutlined />
                  <span>能力详情</span>
                  {activeNode && (
                    <Tag size="small" color={activeNode.level === 1 ? 'blue' : activeNode.level === 2 ? 'green' : 'orange'}>
                      L{activeNode.level}
                    </Tag>
                  )}
                </>
              )}
            </Space>
          }
          headerExtraContent={
            viewMode === 'keyboard' ? (
              <Button
                size="small"
                type="primary"
                theme={keyboardEditMode ? 'solid' : 'outline'}
                icon={keyboardEditMode ? <EyeOutlined /> : <EditOutlined />}
                onClick={() => setKeyboardEditMode((v) => !v)}
              >
                {keyboardEditMode ? '返回预览' : '编辑'}
              </Button>
            ) : null
          }
          bodyStyle={{ padding: 0, height: 'calc(100% - 49px)', overflow: 'hidden' }}
        >
          {viewMode === 'keyboard' ? (
            keyboardEditMode ? (
              <KeyboardCanvas
                capabilities={capabilities ?? []}
                levelFilter={levelFilter}
                onNodeClick={setDrawerNodeId}
              />
            ) : activeNode ? (
              <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
                <NodeDetail node={activeNode} />
              </div>
            ) : (
              <Empty>从左侧选择一个能力节点查看预览</Empty>
            )
          ) : activeNode ? (
            <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
              <CapabilityMapDetail node={activeNode} />
            </div>
          ) : (
            <Empty>从左侧选择一个能力节点查看详情</Empty>
          )}
        </Card>
      </div>

      <NodeDrawer
        nodeId={drawerNodeId}
        capabilities={capabilities ?? []}
        onClose={() => setDrawerNodeId(null)}
      />
    </div>
  );
}

// ============ 节点详情 Drawer（键盘图编辑模式点击节点弹出） ============
function NodeDrawer({
  nodeId,
  capabilities,
  onClose,
}: {
  nodeId: string | null;
  capabilities: Capability[];
  onClose: () => void;
}) {
  const node = useMemo(() => (nodeId ? findNodeByKey(capabilities, nodeId) : null), [nodeId, capabilities]);
  const children = node?.children ?? [];
  const totalChildren = children.length;
  const totalDescendants = (() => {
    let count = 0;
    const stack = [...children];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.children) stack.push(...n.children);
      count++;
    }
    return count;
  })();

  return (
    <SideSheet
      visible={!!nodeId}
      onCancel={onClose}
      title={node ? `能力详情 · ${node.code ?? ''}` : '能力详情'}
      width={420}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>关闭</Button>
        </div>
      }
    >
      {node ? (
        <Space vertical spacing={16} style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>名称</Text>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
              <Tag size="small" color={node.level === 1 ? 'blue' : node.level === 2 ? 'green' : 'orange'} style={{ marginRight: 8 }}>
                L{node.level}
              </Tag>
              {node.name}
            </div>
          </div>
          <Descriptions
            column={1}
            size="small"
            data={[
              { key: '编码', value: node.code ?? '-' },
              { key: '层级', value: `L${node.level}` },
              { key: '状态', value: STATUS_LABEL[node.status] ?? node.status },
              { key: '直接下级', value: `${totalChildren} 个` },
              { key: '下级流程数（含子子级）', value: `${totalDescendants}` },
              { key: '更新时间', value: node.updatedAt ? new Date(node.updatedAt).toLocaleString('zh-CN') : '-' },
            ]}
          />
          {node.description && (
            <Card title="描述" bodyStyle={{ padding: 12 }}>
              <Text>{node.description}</Text>
            </Card>
          )}
          {children.length > 0 && (
            <Card title={`子能力 (${children.length})`} bodyStyle={{ padding: 8 }}>
              <Space vertical spacing={4} style={{ width: '100%' }}>
                {children.map((c) => (
                  <div key={c.capabilityId} style={{ padding: '6px 10px', borderRadius: 4, background: 'var(--muted)' }}>
                    <Space spacing={6}>
                      <Tag size="small" color={c.level === 2 ? 'green' : 'orange'}>L{c.level}</Tag>
                      <Text strong style={{ fontSize: 13 }}>{c.name}</Text>
                    </Space>
                  </div>
                ))}
              </Space>
            </Card>
          )}
        </Space>
      ) : (
        <Empty>未选中节点</Empty>
      )}
    </SideSheet>
  );
}

// ============ KeyboardCanvas：flowgram 无限画布渲染能力节点 ============
const capabilityNodeRegistries: WorkflowNodeRegistry[] = [
  {
    type: 'capability',
    meta: {
      defaultExpanded: true,
      size: { width: 200, height: 60 },
    },
  },
];

function CapabilityNode() {
  const { node, nodeRef } = useNodeRender();
  // 通过 id 查表获取节点数据（materials 路径下 data 不可靠）
  const data = NODE_DATA[node.id] ?? { level: 1, name: node.id, code: '' };
  const size = NODE_SIZE(data.level);
  const isL1 = data.level === 1;
  const isL2 = data.level === 2;
  const isL3 = data.level === 3;
  // L1 主色实心 / L2 浅色背景 / L3 更浅背景 + 边框
  const bg = isL1
    ? 'var(--semi-color-primary)'
    : isL2
      ? 'var(--semi-color-primary-light-default, var(--semi-color-fill-1))'
      : 'var(--muted)';
  const textColor = isL1 ? '#fff' : 'var(--foreground)';
  const fontSize = isL1 ? 13 : isL2 ? 13 : 12;
  return (
    <div
      ref={nodeRef as unknown as React.RefObject<HTMLDivElement>}
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        color: textColor,
        border: !isL1 ? '1px solid var(--border)' : 'none',
        borderRadius: 4,
        padding: isL1 ? '0 16px' : isL3 ? '0 10px' : '6px 12px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isL1 ? 'flex-start' : isL3 ? 'flex-start' : 'center',
        gap: isL3 ? 0 : 8,
        cursor: 'grab',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
      data-level={data.level}
    >
      {isL1 ? (
        // L1 横条：左对齐，左侧 L 标签 + 编码 + 名称
        <>
          <span
            style={{
              display: 'inline-block',
              padding: '1px 6px',
              borderRadius: 2,
              background: 'rgba(255,255,255,0.18)',
              fontSize: 11,
              fontWeight: 600,
              marginRight: 8,
            }}
          >
            L{data.level}
          </span>
          {data.code && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.85, marginRight: 10 }}>
              {data.code}
            </span>
          )}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{data.name}</span>
        </>
      ) : isL3 ? (
        // L3 纵列小条：左对齐、单行截断
        <span style={{ fontSize: fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
          {data.name}
        </span>
      ) : (
        // L2 方块：居中
        <>
          <span
            style={{
              display: 'inline-block',
              padding: '0 4px',
              borderRadius: 2,
              background: 'var(--muted)',
              color: 'var(--muted-foreground)',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            L{data.level}
          </span>
          <span style={{ fontSize: fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </span>
        </>
      )}
    </div>
  );
}

function KeyboardCanvas({ capabilities, levelFilter, onNodeClick }: { capabilities: Capability[]; levelFilter: LevelFilter; onNodeClick?: (id: string) => void }) {
  // 把 Capability[] 转成过滤后的 WorkflowJSON：保留所有 L1-L3 节点，但过滤掉不匹配 level 的节点 + 其孤立子节点
  const { workflow } = useMemo(() => {
    // 读取持久化的画布配置（用户手动调整过的位置）
    const overrides = loadCanvasOverrides();
    const layout = buildKeyboardLayout(capabilities, overrides);
    const keepIds = new Set(
      layout.nodes
        .filter((n) => levelFilter === 'all' || String(n.data.level) === levelFilter)
        .map((n) => n.id),
    );
    const filteredNodes = layout.nodes.filter((n) => keepIds.has(n.id));
    const filteredEdges = layout.edges.filter((e) => keepIds.has(e.sourceNodeID) && keepIds.has(e.targetNodeID));
    return {
      workflow: { nodes: filteredNodes, edges: filteredEdges } as WorkflowJSON,
    };
  }, [capabilities, levelFilter]);

  const visibleCount = workflow.nodes.length;
  if (visibleCount === 0) {
    return <Empty>当前层级下暂无节点</Empty>;
  }

  // 通过事件冒泡拿到节点点击：FlowGram 渲染的节点 DOM 元素带 data-node-id，外层捕获。
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const nodeEl = target.closest('[data-node-id]');
    if (nodeEl) {
      const id = nodeEl.getAttribute('data-node-id');
      if (id) onNodeClick?.(id);
    } else {
      // 点击空白区域
      onNodeClick?.(null as unknown as string);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }} onClick={handleContainerClick}>
      <FreeLayoutEditorProvider
        key={`canvas-${levelFilter}-${visibleCount}`}
        initialData={workflow}
        nodeRegistries={capabilityNodeRegistries}
        materials={{ renderDefaultNode: CapabilityNode }}
        onAllLayersRendered={(ctx) => {
          requestAnimationFrame(() => ctx.tools.fitView(false));
        }}
        readonly
      >
        <EditorRenderer style={{ width: '100%', height: '100%' }} />
      </FreeLayoutEditorProvider>
    </div>
  );
}

/** localStorage 持久化：画布节点位置 override + 选中节点 */
const CANVAS_OVERRIDES_KEY = 'mate:arch:business:canvas-overrides';

function loadCanvasOverrides(): Record<string, { x: number; y: number }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CANVAS_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : {};
  } catch {
    return {};
  }
}

function saveCanvasOverride(id: string, pos: { x: number; y: number }): void {
  if (typeof window === 'undefined') return;
  try {
    const cur = loadCanvasOverrides();
    cur[id] = pos;
    localStorage.setItem(CANVAS_OVERRIDES_KEY, JSON.stringify(cur));
  } catch {
    /* ignore quota */
  }
}

/** 模块级静态节点数据表（通过 id 查表，给 CapabilityNode 用） */
const NODE_DATA: Record<string, { level: number; name: string; code: string }> = {};
function rebuildNodeData(caps: Capability[]): void {
  for (const c of caps) {
    NODE_DATA[c.capabilityId] = { level: c.level, name: c.name, code: c.code ?? '' };
    if (c.children) rebuildNodeData(c.children);
  }
}

// ============ 能力地图模式：能力详情 + 子能力列表 + 关联入口 ============
function CapabilityMapDetail({ node }: { node: Capability }) {
  const children = node.children ?? [];

  return (
    <Space vertical spacing={24} style={{ width: '100%' }}>
      {/* 头部：能力名 + L 标签 + 状态 */}
      <div
        style={{
          background: 'var(--semi-color-primary-light-default, var(--semi-color-fill-1))',
          border: '1px solid var(--border)',
          borderLeft: '4px solid var(--semi-color-primary)',
          borderRadius: 8,
          padding: '16px 20px',
        }}
      >
        <Space spacing={8} align="center">
          <Tag color={node.level === 1 ? 'blue' : node.level === 2 ? 'green' : 'orange'}>L{node.level}</Tag>
          <Text strong style={{ fontSize: 16 }}>{node.name}</Text>
          <Tag>{STATUS_LABEL[node.status] ?? node.status}</Tag>
        </Space>
        {node.description && (
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
            {node.description}
          </Text>
        )}
      </div>

      {/* 属性卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <PropertyCard label="编码" value={node.code} />
        <PropertyCard label="层级" value={`L${node.level}`} />
        <PropertyCard label="子能力数" value={children.length.toString()} />
        <PropertyCard label="更新时间" value={node.updatedAt ? new Date(node.updatedAt).toLocaleDateString() : '-'} />
      </div>

      {/* 子能力列表（能力地图主体） */}
      {children.length > 0 ? (
        <Card title={`子能力 (${children.length})`} bodyStyle={{ padding: 8 }}>
          <Space vertical spacing={4} style={{ width: '100%' }}>
            {children.map((child) => (
              <div
                key={child.capabilityId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 4,
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                <Space spacing={8}>
                  <Tag size="small" color={child.level === 2 ? 'green' : 'orange'}>L{child.level}</Tag>
                  <Text strong style={{ fontSize: 13 }}>{child.name}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>{child.code}</Text>
              </div>
            ))}
          </Space>
        </Card>
      ) : (
        <Card bodyStyle={{ padding: 24, textAlign: 'center' }}>
          <Text type="secondary">该能力无子节点</Text>
        </Card>
      )}

      {/* 关联入口 */}
      <Card title="关联入口" bodyStyle={{ padding: 12 }}>
        <Space wrap spacing={8}>
          <EntryLink href="#/arch/processes" label="关联流程" />
          <EntryLink href="#/arch/applications" label="关联应用" />
          <EntryLink href="#/arch/value-streams" label="所属价值流" />
          <EntryLink href="#/arch/data" label="关联数据实体" />
        </Space>
      </Card>
    </Space>
  );
}

function EntryLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 4,
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
        fontSize: 13,
        textDecoration: 'none',
        transition: 'border-color .15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--semi-color-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      }}
    >
      {label} →
    </a>
  );
}

// ============ 当前节点详情（中间区） ============
function NodeDetail({ node }: { node: Capability }) {
  const children = node.children ?? [];
  const subProcessCount = Math.max(2, children.length * 3);

  return (
    <Space vertical spacing="medium" style={{ width: '100%' }}>
      {/* 缩略图（键盘图样式：单节点 + 子节点 + 状态标签） */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            minWidth: 320,
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--semi-color-primary)',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: 4,
              textAlign: 'center',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            L{node.level} · {node.name}
          </div>
          {children.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {children.map(child => (
                <div
                  key={child.capabilityId}
                  style={{
                    background: 'var(--semi-color-primary-light-default, var(--semi-color-fill-1))',
                    color: 'var(--foreground)',
                    padding: '8px 14px',
                    borderRadius: 4,
                    textAlign: 'center',
                    fontSize: 13,
                  }}
                >
                  L{child.level} · {child.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 属性信息 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <PropertyCard label="编码" value={node.code} />
        <PropertyCard label="层级" value={`L${node.level}`} />
        <PropertyCard label="状态" value={STATUS_LABEL[node.status] ?? node.status} />
        <PropertyCard
          label="关联流程数"
          value={subProcessCount.toString()}
        />
        <PropertyCard
          label="子能力数"
          value={children.length.toString()}
        />
        <PropertyCard label="更新时间" value={node.updatedAt ? new Date(node.updatedAt).toLocaleDateString() : '-'} />
      </div>

      {node.description && (
        <Card title="描述" bodyStyle={{ padding: 12 }}>
          <Text>{node.description}</Text>
        </Card>
      )}
    </Space>
  );
}

function PropertyCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--muted)',
        borderRadius: 6,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--foreground)', marginTop: 4, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ============ 右侧：流程体系框架（Operating/Enabling/Supporting 三组水平条） ============
const FRAMEWORK_GROUPS = [
  {
    key: 'operating',
    label: '运营流程',
    labelEn: 'Operating',
    color: 'var(--semi-color-primary)',
    weight: '45%',
  },
  {
    key: 'enabling',
    label: '使能流程',
    labelEn: 'Enabling',
    color: 'var(--semi-color-success)',
    weight: '28%',
  },
  {
    key: 'supporting',
    label: '支撑流程',
    labelEn: 'Supporting',
    color: 'var(--semi-color-info)',
    weight: '15%',
  },
] as const;

function FrameworkPanel({ capabilities, onSelect }: { capabilities: Capability[]; onSelect: (id: string) => void }) {
  // 把 L1 节点分到三组（按 capabilityId 哈希分桶，保证稳定）
  const buckets: Record<string, Capability[]> = { operating: [], enabling: [], supporting: [] };
  capabilities.forEach((c) => {
    const h = simpleHash(c.capabilityId);
    const bucket = h < 0.45 ? 'operating' : h < 0.73 ? 'enabling' : 'supporting';
    buckets[bucket].push(c);
  });

  return (
    <Space vertical spacing={24} style={{ width: '100%' }}>
      {FRAMEWORK_GROUPS.map((group) => (
        <div key={group.key}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Text strong style={fontSize14}>{group.label}</Text>
            <Text type="secondary" style={fontSize12}>{group.labelEn}</Text>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {buckets[group.key].length === 0 ? (
              <div
                style={{
                  height: 32,
                  background: 'var(--muted)',
                  border: '1px dashed var(--border)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted-foreground)',
                  fontSize: 12,
                }}
              >
                暂无节点
              </div>
            ) : (
              buckets[group.key].map((c) => (
                <div
                  key={c.capabilityId}
                  onClick={() => onSelect(c.capabilityId)}
                  style={{
                    background: group.color,
                    color: '#fff',
                    padding: '10px 16px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: 500,
                    fontSize: 13,
                    transition: 'filter .15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.filter = 'none';
                  }}
                >
                  {c.name}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </Space>
  );
}

const fontSize14 = { fontSize: 14 };
const fontSize12 = { fontSize: 12 };

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

// ============ 把 Capability[] 转成 Semi Tree 的 treeData ============
function buildTreeData(caps: Capability[], keyword: string): TreeNodeData[] {
  const lowerKw = keyword.trim().toLowerCase();
  const match = (c: Capability) =>
    !lowerKw || c.name.toLowerCase().includes(lowerKw) || (c.code ?? '').toLowerCase().includes(lowerKw);

  const walk = (c: Capability): TreeNodeData | null => {
    const matchedKids = (c.children ?? []).map(walk).filter((n): n is TreeNodeData => n !== null);
    const selfMatched = match(c);
    const kidsMatched = matchedKids.length > 0;
    if (!selfMatched && !kidsMatched) return null;
    return {
      key: c.capabilityId,
      label: (
        <Space spacing={6}>
          <Tag
            size="small"
            color={c.level === 1 ? 'blue' : c.level === 2 ? 'green' : 'orange'}
          >
            L{c.level}
          </Tag>
          <span style={selfMatched ? { color: 'var(--foreground)', fontWeight: c.level === 1 ? 600 : 400 } : { color: 'var(--muted-foreground)' }}>
            {c.name}
          </span>
        </Space>
      ),
      children: matchedKids,
    };
  };
  return caps.map(walk).filter((n): n is TreeNodeData => n !== null);
}

function findNodeByKey(caps: Capability[], key: string | undefined): Capability | null {
  if (!key) return null;
  const stack = [...caps];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.capabilityId === key) return n;
    if (n.children) stack.push(...n.children);
  }
  return null;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--muted-foreground)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: '已激活',
  deprecated: '已弃用',
  planned: '规划中',
};

// ============ Fallback 数据（后端不可达时使用） ============
const FALLBACK_CAPS: Capability[] = [
  {
    capabilityId: 'cap-1',
    name: 'IPD-管理集成产品开发',
    code: 'IPD',
    level: 1,
    status: 'active',
    description: '集成产品开发流程，覆盖产品全生命周期',
    children: [
      {
        capabilityId: 'cap-1-1',
        name: '产品规划与立项',
        code: 'IPD-PLP',
        level: 2,
        status: 'active',
        children: [
          { capabilityId: 'cap-1-1-1', name: '需求管理', code: 'IPD-PLP-RM', level: 3, status: 'active' },
          { capabilityId: 'cap-1-1-2', name: '洞察与商业构想', code: 'IPD-PLP-INS', level: 3, status: 'active' },
          { capabilityId: 'cap-1-1-3', name: '产品组合路标规划', code: 'IPD-PLP-RM', level: 3, status: 'active' },
          { capabilityId: 'cap-1-1-4', name: '产品用户体验规划', code: 'IPD-PLP-UX', level: 3, status: 'active' },
          { capabilityId: 'cap-1-1-5', name: '产品 Charter 开发', code: 'IPD-PLP-CHARTER', level: 3, status: 'active' },
        ],
      },
      {
        capabilityId: 'cap-1-2',
        name: '造型设计',
        code: 'IPD-ID',
        level: 2,
        status: 'active',
        children: [
          { capabilityId: 'cap-1-2-1', name: '前端造型设计', code: 'IPD-ID-FE', level: 3, status: 'active' },
          { capabilityId: 'cap-1-2-2', name: '前舱造型设计', code: 'IPD-ID-FF', level: 3, status: 'active' },
          { capabilityId: 'cap-1-2-3', name: '量产造型设计', code: 'IPD-ID-MP', level: 3, status: 'active' },
        ],
      },
      {
        capabilityId: 'cap-1-3',
        name: '技术规划与开发',
        code: 'IPD-TPD',
        level: 2,
        status: 'active',
        children: [
          { capabilityId: 'cap-1-3-1', name: '创新 IDEA 管理', code: 'IPD-TPD-IDEA', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-2', name: '技术情报与洞察', code: 'IPD-TPD-INTEL', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-3', name: '技术规划', code: 'IPD-TPD-PLAN', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-4', name: '技术 Charter', code: 'IPD-TPD-CHARTER', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-5', name: '技术预研', code: 'IPD-TPD-RD', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-6', name: '技术开发', code: 'IPD-TPD-DEV', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-7', name: '技术货架(CBB)', code: 'IPD-TPD-CBB', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-8', name: '技术标准开发', code: 'IPD-TPD-STD', level: 3, status: 'active' },
          { capabilityId: 'cap-1-3-9', name: '技术合作', code: 'IPD-TPD-COOP', level: 3, status: 'active' },
        ],
      },
      {
        capabilityId: 'cap-1-4',
        name: '产品开发',
        code: 'IPD-PD',
        level: 2,
        status: 'active',
        children: [
          { capabilityId: 'cap-1-4-1', name: '概念阶段', code: 'IPD-PD-CON', level: 3, status: 'active' },
          { capabilityId: 'cap-1-4-2', name: '计划阶段', code: 'IPD-PD-PLN', level: 3, status: 'active' },
          { capabilityId: 'cap-1-4-3', name: '开发阶段', code: 'IPD-PD-DEV', level: 3, status: 'active' },
          { capabilityId: 'cap-1-4-4', name: '验证阶段', code: 'IPD-PD-VER', level: 3, status: 'active' },
          { capabilityId: 'cap-1-4-5', name: '发布阶段', code: 'IPD-PD-REL', level: 3, status: 'active' },
        ],
      },
      {
        capabilityId: 'cap-1-5',
        name: '产品生命周期',
        code: 'IPD-LCM',
        level: 2,
        status: 'active',
        children: [
          { capabilityId: 'cap-1-5-1', name: '产品绩效管理', code: 'IPD-LCM-PPM', level: 3, status: 'active' },
          { capabilityId: 'cap-1-5-2', name: 'EOM 管理', code: 'IPD-LCM-EOM', level: 3, status: 'active' },
          { capabilityId: 'cap-1-5-3', name: 'EOP 管理', code: 'IPD-LCM-EOP', level: 3, status: 'active' },
          { capabilityId: 'cap-1-5-4', name: 'EOS 管理', code: 'IPD-LCM-EOS', level: 3, status: 'active' },
        ],
      },
      {
        capabilityId: 'cap-1-6',
        name: '开发管理',
        code: 'IPD-DM',
        level: 2,
        status: 'active',
        children: [
          { capabilityId: 'cap-1-6-1', name: '系统分析与设计', code: 'IPD-DM-SA', level: 3, status: 'active' },
          { capabilityId: 'cap-1-6-2', name: '软件开发', code: 'IPD-DM-SW', level: 3, status: 'active' },
          { capabilityId: 'cap-1-6-3', name: '硬件开发', code: 'IPD-DM-HW', level: 3, status: 'active' },
          { capabilityId: 'cap-1-6-4', name: '结构开发', code: 'IPD-DM-MECH', level: 3, status: 'active' },
          { capabilityId: 'cap-1-6-5', name: '系统集成与验证', code: 'IPD-DM-SIV', level: 3, status: 'active' },
          { capabilityId: 'cap-1-6-6', name: '研发外包管理', code: 'IPD-DM-OUT', level: 3, status: 'active' },
          { capabilityId: 'cap-1-6-7', name: '零部件开发管理', code: 'IPD-DM-PART', level: 3, status: 'active' },
        ],
      },
      {
        capabilityId: 'cap-1-7',
        name: '产品开发协同',
        code: 'IPD-COL',
        level: 2,
        status: 'active',
        children: [
          { capabilityId: 'cap-1-7-1', name: 'PDT 团队', code: 'IPD-COL-PDT', level: 3, status: 'active' },
          { capabilityId: 'cap-1-7-2', name: '项目变更管理', code: 'IPD-COL-CHG', level: 3, status: 'active' },
        ],
      },
    ],
  },
  {
    capabilityId: 'cap-2',
    name: 'IPMS-管理集成营销链',
    code: 'IPMS',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-2-1', name: '品牌管理', code: 'IPMS-BRAND', level: 2, status: 'active' },
      { capabilityId: 'cap-2-2', name: '营销战略规划', code: 'IPMS-MSP', level: 2, status: 'active' },
      { capabilityId: 'cap-2-3', name: '营销活动执行', code: 'IPMS-MEX', level: 2, status: 'active' },
      { capabilityId: 'cap-2-4', name: '客户关系管理', code: 'IPMS-CRM', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-3',
    name: 'MTC-管理市场到回款',
    code: 'MTC',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-3-1', name: '订单管理', code: 'MTC-OM', level: 2, status: 'active' },
      { capabilityId: 'cap-3-2', name: '发货与物流', code: 'MTC-LG', level: 2, status: 'active' },
      { capabilityId: 'cap-3-3', name: '回款管理', code: 'MTC-PAY', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-4',
    name: 'SD-管理用户服务',
    code: 'SD',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-4-1', name: '服务请求', code: 'SD-SR', level: 2, status: 'active' },
      { capabilityId: 'cap-4-2', name: '现场服务', code: 'SD-FS', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-5',
    name: 'DSTE-管理战略规划到执行',
    code: 'DSTE',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-5-1', name: '战略制定', code: 'DSTE-ST', level: 2, status: 'active' },
      { capabilityId: 'cap-5-2', name: '战略解码', code: 'DSTE-DEC', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-6',
    name: 'Supply-管理供应',
    code: 'SUPPLY',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-6-1', name: '供应商管理', code: 'SUPPLY-VM', level: 2, status: 'active' },
      { capabilityId: 'cap-6-2', name: '采购执行', code: 'SUPPLY-PEX', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-7',
    name: 'Manufacturing-管理制造',
    code: 'MFG',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-7-1', name: '生产计划', code: 'MFG-PP', level: 2, status: 'active' },
      { capabilityId: 'cap-7-2', name: '生产执行', code: 'MFG-EX', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-8',
    name: 'Procurement-管理采购',
    code: 'PROC',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-8-1', name: '采购寻源', code: 'PROC-SRC', level: 2, status: 'active' },
      { capabilityId: 'cap-8-2', name: '合同管理', code: 'PROC-CT', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-9',
    name: 'Quality-管理质量',
    code: 'QA',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-9-1', name: '质量检验', code: 'QA-INS', level: 2, status: 'active' },
      { capabilityId: 'cap-9-2', name: '质量改进', code: 'QA-IMP', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-10',
    name: 'MCI-资本运作及投资管理',
    code: 'MCI',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-10-1', name: '投资规划', code: 'MCI-IP', level: 2, status: 'active' },
      { capabilityId: 'cap-10-2', name: '投资执行', code: 'MCI-EX', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-11',
    name: 'MHR-管理人力资源',
    code: 'MHR',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-11-1', name: '招聘管理', code: 'MHR-REC', level: 2, status: 'active' },
      { capabilityId: 'cap-11-2', name: '绩效管理', code: 'MHR-PERF', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-12',
    name: 'MFIN-管理财务',
    code: 'MFIN',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-12-1', name: '会计核算', code: 'MFIN-ACC', level: 2, status: 'active' },
      { capabilityId: 'cap-12-2', name: '预算管理', code: 'MFIN-BGT', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-13',
    name: 'MBPIT-管理流程 IT',
    code: 'MBPIT',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-13-1', name: '流程架构', code: 'MBPIT-PA', level: 2, status: 'active' },
      { capabilityId: 'cap-13-2', name: 'IT 治理', code: 'MBPIT-ITG', level: 2, status: 'active' },
    ],
  },
  {
    capabilityId: 'cap-14',
    name: 'MBS-管理综合支撑',
    code: 'MBS',
    level: 1,
    status: 'active',
    children: [
      { capabilityId: 'cap-14-1', name: '行政事务', code: 'MBS-ADM', level: 2, status: 'active' },
      { capabilityId: 'cap-14-2', name: '法务合规', code: 'MBS-LEG', level: 2, status: 'active' },
    ],
  },
];

// ============ Fallback 数据（后端不可达时使用） ============