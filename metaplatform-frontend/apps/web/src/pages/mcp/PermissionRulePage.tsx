import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Popconfirm,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { listRules, createRule, updateRule, deleteRule } from '@/api/mcphub/permissions';
import { listTools } from '@/api/mcphub/tools';
import { listServers } from '@/api/mcphub/servers';
import { listResources } from '@/api/mcphub/resources';
import { listPrompts } from '@/api/mcphub/prompts';
import RuleEditor from './components/RuleEditor';
import { EmptyState, PageHeader } from '@/components/skeleton';
import type {
  PermissionRule,
  PermissionRuleCreateRequest,
  McpTool,
  McpServer,
  PromptTemplate,
} from '@/api/mcphub/types';

export default function PermissionRulePage() {
  const [rules, setRules] = useState<PermissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasRead, setHasRead] = useState(false);
  const [missingResourceIds, setMissingResourceIds] = useState(false);
  const readGeneration = useRef(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resources, setResources] = useState<
    Array<{ type: PermissionRule['resourceType']; id: string; name: string }>
  >([]);

  const load = useCallback(async () => {
    const generation = ++readGeneration.current;
    setLoading(true);
    setLoadError('');
    try {
      const [r, toolsRes, serversRes, resourcesRes, promptsRes] = await Promise.all([
        listRules(),
        listTools(),
        listServers(),
        listResources(),
        listPrompts(),
      ]);
      if (generation !== readGeneration.current) return;
      setRules(r.items);
      const all: Array<{ type: PermissionRule['resourceType']; id: string; name: string }> = [];
      (toolsRes.items as McpTool[]).forEach((t) =>
        all.push({ type: 'tool', id: t.id, name: t.name }),
      );
      (serversRes.items as McpServer[]).forEach((s) =>
        all.push({ type: 'server', id: s.id, name: s.name }),
      );
      setMissingResourceIds(resourcesRes.items.some(resource => !resource.id?.trim()));
      resourcesRes.items.forEach(resource => {
        if (resource.id?.trim()) all.push({ type: 'resource', id: resource.id, name: resource.name });
      });
      (promptsRes.items as PromptTemplate[]).forEach((p) =>
        all.push({ type: 'prompt', id: p.id, name: p.name }),
      );
      setResources(all.filter(resource => typeof resource.id === 'string' && resource.id.trim()));
      setHasRead(true);
    } catch (cause) {
      if (generation === readGeneration.current) setLoadError(cause instanceof Error ? cause.message : '读取失败');
    } finally {
      if (generation === readGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { readGeneration.current++; };
  }, [load]);

  const canWrite = hasRead && !loading && !loadError;

  const handleSubmit = async (values: PermissionRuleCreateRequest) => {
    if (!canWrite) return;
    setSubmitting(true);
    try {
      if (editing) {
        await updateRule(editing.id, values);
        Toast.success('已更新');
      } else {
        await createRule(values);
        Toast.success('已创建');
      }
      setEditorOpen(false);
      setEditing(null);
      void load();
    } catch (cause) {
      Toast.error(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnProps<PermissionRule>[] = [
    {
      title: '规则',
      key: 'name',
      render: (_, r) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <SafetyOutlined /> {r.name}
          </Typography.Text>
          <Typography.Text type="tertiary" className="mp-text-sm">
            优先级 {r.priority}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '主体',
      key: 'subject',
      render: (_, r) => (
        <span>
          <Tag size="small">{r.subjectType}</Tag>
          <span>{r.subjectId}</span>
        </span>
      ),
    },
    {
      title: '资源',
      key: 'resource',
      render: (_, r) => (
        <span>
          <Tag size="small" color="blue">{r.resourceType}</Tag>
          {r.resourceIds.map(id => <Tag key={id}>{id}</Tag>)}
        </span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      render: (value: string) => <Tag size="small" color="purple">{value}</Tag>,
    },
    {
      title: '效果',
      key: 'effect',
      render: (_, r) => (
        <Tag size="small" color={r.effect.toUpperCase() === 'ALLOW' ? 'green' : 'red'}>{r.effect}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v) => (v ? <Tag size="small" color="green">是</Tag> : <Tag size="small">否</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            theme="borderless"
            icon={<EditOutlined />}
            disabled={!canWrite}
            onClick={() => {
              if (!canWrite) return;
              setEditing(r);
              setEditorOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={async () => {
            if (!canWrite) return;
            try {
              await deleteRule(r.id);
              Toast.success('已删除');
              void load();
            } catch (cause) { Toast.error(cause instanceof Error ? cause.message : '删除失败'); }
          }}>
            <Button disabled={!canWrite} size="small" theme="borderless" type="danger" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="权限规则"
        actions={
          <Button
                  theme="solid"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!canWrite}
                  onClick={() => {
                    if (!canWrite) return;
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                >
                  创建规则
                </Button>
        }
      />

      {loadError && <div role="alert" className="mp-read-warning">
        <strong>权限规则加载失败</strong><p>{loadError}</p>
        {hasRead && <p>显示上次成功读取的结果。</p>}
        <Button disabled={loading} onClick={() => void load()} aria-label="重试权限规则">重试</Button>
      </div>}
      {missingResourceIds && <p className="mp-text-sm">资源注册信息没有权限资源 ID，暂时无法选择这些资源配置权限。</p>}

      <Card>
        {rules.length === 0 && !loading && !loadError ? (
          <EmptyState title="还没有权限规则" />
        ) : (
          <Table
            rowKey="id"
            dataSource={rules}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10 }} />
        )}
      </Card>

      <RuleEditor
        open={editorOpen}
        initial={editing}
        resources={resources}
        onOk={handleSubmit}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        confirmLoading={submitting}
        disabled={!canWrite}
      />
    </div>
  );
}
