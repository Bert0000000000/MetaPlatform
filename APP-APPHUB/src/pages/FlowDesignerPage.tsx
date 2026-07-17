import { useState, useCallback, useRef, useEffect } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Input,
  Typography,
  Space,
  message,
  Modal,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { getModule, updateModule } from '@/api/modules';
import { getFlow, saveFlow, validateFlow, testFlow, publishFlow, listFormModules } from '@/api/flows';
import ApprovalConfig from '@/components/ApprovalConfig';
import FormBinding from '@/components/FormBinding';
import FlowTestPanel from '@/components/FlowTestPanel';
import PublishValidation from '@/components/PublishValidation';
import AIProcessGenerate from '@/components/AIProcessGenerate';
import type { ModuleItem, FlowConfig, FlowNode, FlowEdge, FlowNodeType, FlowValidationResult, FlowTestResult, FormFieldBinding } from '@/types';

const { TextArea } = Input;

const NODE_DEFS: { type: FlowNodeType; label: string; icon: string; color: string; width: number; height: number }[] = [
  { type: 'start', label: '开始', icon: '▶', color: '#52c41a', width: 100, height: 60 },
  { type: 'approval', label: '审批', icon: '✓', color: '#1677ff', width: 140, height: 70 },
  { type: 'condition', label: '条件', icon: '◇', color: '#faad14', width: 120, height: 80 },
  { type: 'end', label: '结束', icon: '■', color: '#f5222d', width: 100, height: 60 },
];

const NODE_SIZE: Record<FlowNodeType, { width: number; height: number }> = {
  start: { width: 100, height: 60 },
  approval: { width: 140, height: 70 },
  condition: { width: 120, height: 80 },
  end: { width: 100, height: 60 },
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function FlowDesignerPage() {
  const { appId, moduleId } = useParams<{ appId: string; moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleItem | null>(null);
  const [config, setConfig] = useState<FlowConfig>({ name: '', description: '', nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [testResult, setTestResult] = useState<FlowTestResult | null>(null);
  const [validationResult, setValidationResult] = useState<FlowValidationResult | null>(null);
  const [formModules, setFormModules] = useState<ModuleItem[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!moduleId) return;
    getModule(moduleId).then((m) => {
      setModule(m);
      setConfig({ name: m.name, description: m.description || '', nodes: [], edges: [] });
    });
    getFlow(moduleId).then((flow) => {
      if (flow.nodes.length > 0) {
        setConfig(flow);
      }
    });
    if (appId) {
      listFormModules(appId).then(setFormModules).catch(() => {});
    }
  }, [moduleId, appId]);

  const selectedNode = config.nodes.find((n) => n.id === selectedNodeId) || null;

  const handleAddNode = useCallback((type: FlowNodeType) => {
    const def = NODE_DEFS.find((d) => d.type === type)!;
    const newNode: FlowNode = {
      id: generateId('node'),
      type,
      name: def.label,
      position: {
        x: 100 + Math.random() * 300,
        y: 80 + Math.random() * 200,
      },
    };
    if (type === 'approval') {
      newNode.config = {
        assigneeType: 'person',
        assigneeIds: [],
        approvalMode: 'sequential',
        approvalLevels: 1,
        timeoutHours: 48,
        allowReject: true,
        allowTransfer: false,
        ccList: [],
      };
    } else if (type === 'condition') {
      newNode.config = {
        branches: [
          { id: generateId('branch'), label: '条件1', condition: '' },
        ],
      };
    }
    setConfig((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNodeId(newNode.id);
  }, []);

  const handleNodeClick = useCallback((nodeId: string, e: MouseEvent) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom !== nodeId) {
      const newEdge: FlowEdge = {
        id: generateId('edge'),
        source: connectingFrom,
        target: nodeId,
      };
      setConfig((prev) => {
        const exists = prev.edges.some(
          (ed) => ed.source === connectingFrom && ed.target === nodeId,
        );
        if (exists) return prev;
        return { ...prev, edges: [...prev.edges, newEdge] };
      });
      setConnectingFrom(null);
    } else {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    }
  }, [connectingFrom]);

  const handleNodeDragStart = useCallback((nodeId: string, e: MouseEvent) => {
    e.stopPropagation();
    const node = config.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    setDragging({
      nodeId,
      offsetX: svgX - node.position.x,
      offsetY: svgY - node.position.y,
    });
  }, [config.nodes]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;
    setConfig((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === dragging.nodeId
          ? { ...n, position: { x: svgX - dragging.offsetX, y: svgY - dragging.offsetY } }
          : n,
      ),
    }));
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setConfig((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    setSelectedNodeId(null);
  }, []);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setConfig((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
    }));
    setSelectedEdgeId(null);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<FlowNode>) => {
    setConfig((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    }));
  }, []);

  const handleSave = async () => {
    if (!moduleId) return;
    if (config.nodes.length === 0) {
      message.warning('请至少添加一个节点');
      return;
    }
    setSubmitting(true);
    try {
      await saveFlow(moduleId, config);
      await updateModule(moduleId, { config: { name: config.name, fields: [], submitAction: 'flow' } });
      message.success('流程保存成功');
    } catch {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async () => {
    const result = await validateFlow(config);
    setValidationResult(result);
    if (result.valid) {
      message.success('流程校验通过');
    } else {
      message.error(`校验失败：${result.errors.length} 个错误`);
    }
  };

  const handleTest = async () => {
    const result = await testFlow(config);
    setTestResult(result);
    setTestModalOpen(true);
  };

  const handlePublish = async () => {
    if (!moduleId) return;
    const validation = await validateFlow(config);
    if (!validation.valid) {
      message.error('流程校验未通过，无法发布');
      setValidationResult(validation);
      return;
    }
    setSubmitting(true);
    try {
      const result = await publishFlow(moduleId, config);
      message.success(result.message);
      setPublishModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormBindingChange = useCallback((bindings: FormFieldBinding[]) => {
    if (!selectedNodeId) return;
    handleUpdateNode(selectedNodeId, { formBindings: bindings });
  }, [selectedNodeId, handleUpdateNode]);

  const renderNode = (node: FlowNode) => {
    const def = NODE_DEFS.find((d) => d.type === node.type)!;
    const size = NODE_SIZE[node.type];
    const isSelected = selectedNodeId === node.id;
    const isConnecting = connectingFrom === node.id;

    let shape: ReactNode;
    if (node.type === 'start' || node.type === 'end') {
      shape = (
        <ellipse
          cx={node.position.x + size.width / 2}
          cy={node.position.y + size.height / 2}
          rx={size.width / 2}
          ry={size.height / 2}
          fill={isConnecting ? def.color : `${def.color}33`}
          stroke={def.color}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
    } else if (node.type === 'condition') {
      const cx = node.position.x + size.width / 2;
      const cy = node.position.y + size.height / 2;
      shape = (
        <polygon
          points={`${cx},${node.position.y} ${node.position.x + size.width},${cy} ${cx},${node.position.y + size.height} ${node.position.x},${cy}`}
          fill={isConnecting ? def.color : `${def.color}33`}
          stroke={def.color}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
    } else {
      shape = (
        <rect
          x={node.position.x}
          y={node.position.y}
          width={size.width}
          height={size.height}
          rx={8}
          fill={isConnecting ? def.color : `${def.color}33`}
          stroke={def.color}
          strokeWidth={isSelected ? 3 : 2}
        />
      );
    }

    return (
      <g
        key={node.id}
        style={{ cursor: dragging?.nodeId === node.id ? 'grabbing' : 'grab' }}
        onMouseDown={(e) => handleNodeDragStart(node.id, e)}
        onClick={(e) => handleNodeClick(node.id, e)}
      >
        {shape}
        <text
          x={node.position.x + size.width / 2}
          y={node.position.y + size.height / 2 + 5}
          textAnchor="middle"
          fontSize={13}
          fill="#333"
          fontWeight={600}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.name}
        </text>
        <text
          x={node.position.x + size.width / 2}
          y={node.position.y + size.height / 2 - 10}
          textAnchor="middle"
          fontSize={16}
          fill={def.color}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {def.icon}
        </text>
        {isSelected && (
          <g>
            <circle
              cx={node.position.x + size.width / 2}
              cy={node.position.y + size.height + 12}
              r={6}
              fill="#f5222d"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node.id);
              }}
            />
            <text
              x={node.position.x + size.width / 2}
              y={node.position.y + size.height + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#fff"
              style={{ pointerEvents: 'none' }}
            >
              ×
            </text>
          </g>
        )}
      </g>
    );
  };

  const renderEdge = (edge: FlowEdge) => {
    const source = config.nodes.find((n) => n.id === edge.source);
    const target = config.nodes.find((n) => n.id === edge.target);
    if (!source || !target) return null;

    const sourceSize = NODE_SIZE[source.type];
    const targetSize = NODE_SIZE[target.type];
    const x1 = source.position.x + sourceSize.width / 2;
    const y1 = source.position.y + sourceSize.height;
    const x2 = target.position.x + targetSize.width / 2;
    const y2 = target.position.y;

    const isSelected = selectedEdgeId === edge.id;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return (
      <g key={edge.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isSelected ? '#f5222d' : '#bbb'}
          strokeWidth={isSelected ? 2.5 : 1.5}
          markerEnd="url(#flow-arrow)"
        />
        {edge.label && (
          <text x={midX} y={midY - 4} textAnchor="middle" fontSize={10} fill="#999">
            {edge.label}
          </text>
        )}
        {isSelected && (
          <circle cx={midX} cy={midY} r={8} fill="#f5222d" style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); handleDeleteEdge(edge.id); }} />
        )}
      </g>
    );
  };

  const renderPropertyPanel = () => {
    if (selectedEdgeId) {
      const edge = config.edges.find((e) => e.id === selectedEdgeId);
      if (!edge) return null;
      return (
        <div>
          <Typography.Title level={5}>连线属性</Typography.Title>
          <Input
            placeholder="连线标签（可选）"
            value={edge.label || ''}
            onChange={(e) => {
              setConfig((prev) => ({
                ...prev,
                edges: prev.edges.map((ed) => (ed.id === selectedEdgeId ? { ...ed, label: e.target.value } : ed)),
              }));
            }}
          />
        </div>
      );
    }

    if (!selectedNode) {
      return (
        <div>
          <Typography.Title level={5}>流程属性</Typography.Title>
          <Input
            placeholder="流程名称"
            value={config.name}
            onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
            style={{ marginBottom: 8 }}
          />
          <TextArea
            rows={3}
            placeholder="流程描述"
            value={config.description || ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, description: e.target.value }))}
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
            点击节点查看属性，点击节点底部红色按钮删除节点。选择两个节点可以连线。
          </Typography.Paragraph>
        </div>
      );
    }

    return (
      <div>
        <Typography.Title level={5}>节点属性</Typography.Title>
        <Input
          placeholder="节点名称"
          value={selectedNode.name}
          onChange={(e) => handleUpdateNode(selectedNode.id, { name: e.target.value })}
          style={{ marginBottom: 8 }}
        />
        <Tag color={NODE_DEFS.find((d) => d.type === selectedNode.type)?.color}>
          {NODE_DEFS.find((d) => d.type === selectedNode.type)?.label}
        </Tag>

        {selectedNode.type === 'approval' && (
          <ApprovalConfig
            config={selectedNode.config as Parameters<typeof ApprovalConfig>[0]['config']}
            onChange={(newConfig) => handleUpdateNode(selectedNode.id, { config: newConfig })}
          />
        )}

        {selectedNode.type === 'condition' && (
          <ConditionConfigEditor
            config={selectedNode.config as Parameters<typeof ConditionConfigEditor>[0]['config']}
            onChange={(newConfig) => handleUpdateNode(selectedNode.id, { config: newConfig })}
          />
        )}

        {selectedNode.type !== 'start' && selectedNode.type !== 'end' && (
          <FormBinding
            formModules={formModules}
            bindings={selectedNode.formBindings || []}
            onChange={handleFormBindingChange}
          />
        )}

        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteNode(selectedNode.id)}
          block
          style={{ marginTop: 12 }}
        >
          删除节点
        </Button>
      </div>
    );
  };

  if (!module) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/apps/${appId}`)}>
            返回
          </Button>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {module.name} - 流程设计器
          </Typography.Title>
        </Space>
        <Space>
          <Button
            type={connectingFrom ? 'primary' : 'default'}
            icon={<PlusOutlined />}
            onClick={() => {
              if (connectingFrom) {
                setConnectingFrom(null);
              } else {
                message.info('请点击源节点，然后点击目标节点来创建连线');
              }
            }}
          >
            {connectingFrom ? '取消连线' : '连线模式'}
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={handleValidate}>
            校验
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={handleTest}>
            测试
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
            保存
          </Button>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setPublishModalOpen(true)}>
            发布
          </Button>
          <Button onClick={() => setAiGenerateOpen(true)}>
            AI 生成流程
          </Button>
        </Space>
      </div>

      {validationResult && (
        <PublishValidation result={validationResult} onPublish={handlePublish} publishing={submitting} />
      )}

      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        <Card title="节点面板" style={{ width: 180, overflow: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NODE_DEFS.map((def) => (
              <Button
                key={def.type}
                icon={<span>{def.icon}</span>}
                onClick={() => handleAddNode(def.type)}
                block
              >
                {def.label}
              </Button>
            ))}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 16 }}>
            流程统计：{config.nodes.length} 节点 / {config.edges.length} 连线
          </Typography.Text>
        </Card>

        <Card
          title="流程画布"
          style={{ flex: 1, overflow: 'auto' }}
          onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
        >
          {config.nodes.length === 0 ? (
            <Empty description="点击左侧节点添加到画布" />
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              style={{ minHeight: 500, background: '#fafafa', borderRadius: 8 }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <defs>
                <marker id="flow-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#bbb" />
                </marker>
              </defs>

              {config.edges.map(renderEdge)}
              {config.nodes.map(renderNode)}
            </svg>
          )}
        </Card>

        <Card title="属性配置" style={{ width: 320, overflow: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {renderPropertyPanel()}
        </Card>
      </div>

      <Modal
        title="流程测试"
        open={testModalOpen}
        onCancel={() => setTestModalOpen(false)}
        footer={<Button onClick={() => setTestModalOpen(false)}>关闭</Button>}
        width={760}
      >
        {testResult && <FlowTestPanel result={testResult} />}
      </Modal>

      <Modal
        title="AI 流程生成"
        open={aiGenerateOpen}
        onCancel={() => setAiGenerateOpen(false)}
        footer={null}
        width={680}
      >
        <AIProcessGenerate
          onApply={(gen) => {
            message.info(`已应用 AI 生成的流程：${gen.name}`);
            setAiGenerateOpen(false);
          }}
        />
      </Modal>

      <Modal
        title="发布流程"
        open={publishModalOpen}
        onOk={handlePublish}
        onCancel={() => setPublishModalOpen(false)}
        confirmLoading={submitting}
        okText="确认发布"
        cancelText="取消"
      >
        <Typography.Paragraph>
          发布前将自动进行流程完整性校验。确认发布到 TECH-WFE 工作流引擎？
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          流程名称：{config.name || '未命名'}
        </Typography.Text>
      </Modal>
    </div>
  );
}

function ConditionConfigEditor({
  config,
  onChange,
}: {
  config: { branches: Array<{ id: string; label: string; condition: string }> } | undefined;
  onChange: (config: { branches: Array<{ id: string; label: string; condition: string }> }) => void;
}) {
  const branches = config?.branches || [];

  const handleAddBranch = () => {
    onChange({
      branches: [...branches, { id: generateId('branch'), label: `条件${branches.length + 1}`, condition: '' }],
    });
  };

  const handleUpdateBranch = (id: string, updates: Partial<{ label: string; condition: string }>) => {
    onChange({
      branches: branches.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    });
  };

  const handleDeleteBranch = (id: string) => {
    onChange({ branches: branches.filter((b) => b.id !== id) });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Typography.Text strong>条件分支</Typography.Text>
      {branches.map((branch) => (
        <div key={branch.id} style={{ marginBottom: 8, display: 'flex', gap: 4 }}>
          <Input
            size="small"
            placeholder="分支标签"
            value={branch.label}
            onChange={(e) => handleUpdateBranch(branch.id, { label: e.target.value })}
            style={{ width: 100 }}
          />
          <Input
            size="small"
            placeholder="条件表达式，如：amount > 10000"
            value={branch.condition}
            onChange={(e) => handleUpdateBranch(branch.id, { condition: e.target.value })}
            style={{ flex: 1 }}
          />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteBranch(branch.id)} />
        </div>
      ))}
      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAddBranch} block>
        添加分支
      </Button>
    </div>
  );
}
