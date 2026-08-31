import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Input, Row, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { useParams } from 'react-router-dom';
import {
  getNodeRegistry,
  getWorkflowDefinition,
  publishWorkflowDefinition,
  saveWorkflowDefinition,
  startWorkflowRun,
  type ActionTypeDescriptor,
  type PlanDraft,
  type PlanNode,
  type PlanValidationIssue,
  type WorkflowDefinition,
} from '@/api/wfe/workflowDefinitions';
import { PlanCanvas } from './components/PlanCanvas';
import { PlanInspector } from './components/PlanInspector';

const defaultPlan = (): PlanDraft => ({
  nodes: [
    { id: 'start', type: 'start' },
    {
      id: 'review', type: 'action', action_type: 'order.review',
      input: { order_id: '' }, requires_confirmation: true,
    },
    { id: 'end', type: 'end' },
  ],
  edges: [{ source: 'start', target: 'review' }, { source: 'review', target: 'end' }],
});

function errorMessage(error: unknown): string {
  const candidate = error as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = candidate.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'issues' in detail) {
    const issues = (detail as { issues?: PlanValidationIssue[] }).issues || [];
    return issues.map((issue) => issue.message).join('；') || '工作流校验失败';
  }
  return candidate.message || '请求失败，请稍后重试。';
}

export default function ActionOrchestrationPage() {
  const { definitionId = 'order-review' } = useParams<{ definitionId: string }>();
  const rootRef = useRef<HTMLDivElement>(null);
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [name, setName] = useState('订单复核行动编排');
  const [plan, setPlan] = useState<PlanDraft>(defaultPlan);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('review');
  const [actionTypes, setActionTypes] = useState<ActionTypeDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<PlanValidationIssue[]>([]);

  const selectedNode = useMemo(
    () => plan.nodes.find((node) => node.id === selectedNodeId) || null,
    [plan.nodes, selectedNodeId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loaded, registry] = await Promise.all([getWorkflowDefinition(definitionId), getNodeRegistry()]);
      setDefinition(loaded);
      setName(loaded.name);
      setPlan(loaded.draft_plan);
      setIssues(loaded.validation?.issues || []);
      setActionTypes(registry.find((item) => item.type === 'action')?.action_types || []);
    } catch (loadError) {
      const status = (loadError as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        try {
          const registry = await getNodeRegistry();
          setActionTypes(registry.find((item) => item.type === 'action')?.action_types || []);
        } catch (registryError) {
          setError(errorMessage(registryError));
        }
      } else {
        setError(errorMessage(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [definitionId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveWorkflowDefinition(definitionId, {
        name,
        version: definition?.version || 0,
        draft_plan: plan,
      });
      setDefinition(saved);
      setPlan(saved.draft_plan);
      setIssues(saved.validation?.issues || []);
      Toast.success('草稿已保存');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!definition) {
      setError('请先保存草稿，再发布。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const published = await publishWorkflowDefinition(definitionId, `publish-${definitionId}-${definition.version}`);
      setDefinition(published);
      setIssues([]);
      Toast.success(`已发布版本 ${published.published_version}`);
    } catch (publishError) {
      setError(errorMessage(publishError));
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (!definition?.published_version) {
      setError('请先发布有效版本，再启动运行。');
      return;
    }
    setSaving(true);
    try {
      const runResult = await startWorkflowRun(definitionId, `run-${definitionId}-${Date.now()}`);
      Toast.success(`运行已启动：${runResult.run_id}`);
    } catch (runError) {
      setError(errorMessage(runError));
    } finally {
      setSaving(false);
    }
  };

  const updateNode = (updated: PlanNode) => {
    setPlan((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === updated.id ? updated : node),
    }));
  };

  const deleteNode = (nodeId: string) => {
    setPlan((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    }));
    setSelectedNodeId(null);
  };

  return (
    <div ref={rootRef} style={{ padding: 24, minHeight: '100%' }}>
      <Space vertical align="start" spacing="medium" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Typography.Title heading={3} style={{ margin: 0 }}>行动编排</Typography.Title>
            <Typography.Text type="secondary">服务端版本化 Plan 定义 · 发布后按不可变版本运行</Typography.Text>
          </div>
          <Space>
            <Button onClick={() => void rootRef.current?.requestFullscreen?.()}>全屏编辑</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void save()}>保存草稿</Button>
            <Button theme="solid" type="tertiary" loading={saving} onClick={() => void publish()}>发布</Button>
            <Button loading={saving} onClick={() => void run()}>启动运行</Button>
          </Space>
        </div>
        {definition && <Space><Tag color="blue">草稿 v{definition.version}</Tag>{definition.published_version && <Tag color="green">已发布 v{definition.published_version}</Tag>}</Space>}
        {error && <Card style={{ width: '100%', borderColor: 'var(--semi-color-danger)' }}><Typography.Text type="danger">{error}</Typography.Text></Card>}
        {issues.length > 0 && (
          <Card title="发布前需要处理" style={{ width: '100%' }}>
            {issues.map((issue, index) => <Typography.Paragraph key={`${issue.code}-${index}`} type="danger" style={{ margin: '4px 0' }}>{issue.node_id ? `${issue.node_id}：` : ''}{issue.message}</Typography.Paragraph>)}
          </Card>
        )}
        <Card style={{ width: '100%' }}>
          <Typography.Text strong>定义名称</Typography.Text>
          <Input value={name} onChange={setName} disabled={loading} style={{ marginTop: 8 }} />
        </Card>
        <Row gutter={16} style={{ width: '100%' }}>
          <Col span={17}><Card title="Plan 画布"><PlanCanvas plan={plan} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} onDeleteNode={deleteNode} /></Card></Col>
          <Col span={7}><Card title="节点配置"><PlanInspector node={selectedNode} actionTypes={actionTypes} onChange={updateNode} /></Card></Col>
        </Row>
      </Space>
    </div>
  );
}
