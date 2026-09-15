import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spin, Tag, Toast, Tooltip } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { listKnowledge, promoteFeedback } from '@/api/dw/learning';
import type { LearnedKnowledge } from '@/api/dw/types';
import { DataTablePro, EmptyState, PageHeader, type DataTableProProps } from '@/components/skeleton';
import '@/pages/agents/agents.css';

/**
 * 数字员工 · 学习沉淀（V15-03 消费页）。
 *
 * 数据面 src/api/dw/learning：
 *  - listKnowledge：员工沉淀的知识条目
 *  - promoteFeedback：把条目来源的 feedback 片段重新回灌知识库（P2.10）
 *
 * promote 的可用性规则原样保留：条目必须有 sourceFeedbackIds[0]，且未同步过；
 * 否则按钮禁用并给出原因，不使用 knowledgeId 之类的兜底 id（历史上会打到不存在的
 * feedback 上导致 404）。
 */

type Meta = { label: string; color: TagColor };

const TYPE_META: Record<string, Meta> = {
  prompt_fragment: { label: '提示词片段', color: 'blue' },
  tool_rule: { label: '工具规则', color: 'purple' },
  parameter_template: { label: '参数模板', color: 'cyan' },
  experience: { label: '经验', color: 'teal' },
};

function metaOf(map: Record<string, Meta>, key: unknown): Meta {
  const k = typeof key === 'string' && key ? key : '';
  if (!k) return { label: '—', color: 'grey' };
  return map[k] ?? { label: k, color: 'grey' };
}

export default function LearningPage() {
  const [items, setItems] = useState<LearnedKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res: LearnedKnowledge[] | { items?: LearnedKnowledge[] } = await listKnowledge('');
      setItems(Array.isArray(res) ? res : (res?.items ?? []));
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePromote = async (feedbackId: string | undefined) => {
    if (!feedbackId) {
      Toast.error('该条目未关联 feedback id，无法提升');
      return;
    }
    setPromoting(feedbackId);
    try {
      const res = await promoteFeedback(feedbackId);
      Toast.success(`已提升至知识库 (${res.promotedDocumentId ?? res.promoted_document_id})`);
    } catch {
      Toast.error('提升失败，请稍后重试');
    } finally {
      setPromoting(null);
    }
  };

  const columns: DataTableProProps<LearnedKnowledge>['columns'] = [
    { title: '标题', dataIndex: 'title', width: 260, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'knowledgeType',
      width: 130,
      render: (_: unknown, r: LearnedKnowledge) => {
        const meta = metaOf(TYPE_META, r.knowledgeType);
        return (
          <Tag size="small" color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '置信度', dataIndex: 'confidence', width: 100 },
    {
      title: '同步状态',
      dataIndex: 'syncedToKb',
      width: 110,
      render: (_: unknown, r: LearnedKnowledge) => (
        <Tag size="small" color={r.syncedToKb ? 'green' : 'grey'} type="light">
          {r.syncedToKb ? '已同步' : '未同步'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_: unknown, r: LearnedKnowledge) => {
        const feedbackId = r.sourceFeedbackIds?.[0];
        const noFeedback = !feedbackId;
        const button = (
          <Button
            size="small"
            type="secondary"
            theme="light"
            loading={promoting === feedbackId}
            disabled={r.syncedToKb || noFeedback}
            onClick={() => void handlePromote(feedbackId)}
          >
            提升至知识库
          </Button>
        );
        return noFeedback ? (
          <Tooltip content="该条目没有关联的 sourceFeedbackIds，无法调用 promote 接口">
            <span>{button}</span>
          </Tooltip>
        ) : (
          button
        );
      },
    },
  ];

  const syncedCount = items.filter((i) => i.syncedToKb).length;

  return (
    <>
      <PageHeader
        title="学习沉淀"
        desc={
          error
            ? undefined
            : loading
              ? '正在加载学习沉淀…'
              : `共 ${items.length} 条沉淀 · 已同步 ${syncedCount} 条`
        }
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="学习沉淀加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading && items.length === 0 ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : (
        <Card>
          <DataTablePro<LearnedKnowledge>
            columns={columns}
            dataSource={items}
            rowKey="knowledgeId"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无学习沉淀"
                desc="数字员工从反馈中沉淀出知识后，会在这里出现。"
              />
            }
          />
        </Card>
      )}
    </>
  );
}
