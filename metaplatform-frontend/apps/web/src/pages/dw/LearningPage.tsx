import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Select, Spin, Tag, Toast, Tooltip } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { RefreshCw } from 'lucide-react';
import { listKnowledge, promoteFeedback } from '@/api/dw/learning';
import { listEmployees } from '@/api/dw/employees';
import type { Employee, LearnedKnowledge } from '@/api/dw/types';
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
type EmployeePageQuery = NonNullable<Parameters<typeof listEmployees>[0]> & { page: number; size: number };

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState('');
  const [promoting, setPromoting] = useState<string | null>(null);
  const employeeRequest = useRef(0);
  const knowledgeRequest = useRef(0);

  const loadEmployees = useCallback(async () => {
    const requestId = ++employeeRequest.current;
    setEmployeesLoading(true);
    setEmployeesError('');
    try {
      const all: Employee[] = [];
      let page = 1;
      let size = 20;
      for (;;) {
        const query: EmployeePageQuery = { page, size };
        const res = await listEmployees(query);
        if (requestId !== employeeRequest.current) return;
        if (res.page !== page || !Number.isInteger(res.pageSize) || res.pageSize < 1
          || !Number.isInteger(res.total) || res.total < 0) {
          throw new Error('员工列表分页响应不完整，无法读取全部员工。');
        }
        all.push(...res.items);
        if (all.length >= res.total) break;
        if (!res.items.length) throw new Error('员工列表分页读取未完成，请重试。');
        page = res.page + 1;
        size = res.pageSize;
      }
      setEmployees(all);
    } catch (e) {
      if (requestId === employeeRequest.current) {
        setEmployees([]);
        setEmployeesError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (requestId === employeeRequest.current) setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
    return () => { employeeRequest.current += 1; };
  }, [loadEmployees]);

  const load = useCallback(async () => {
    const requestId = ++knowledgeRequest.current;
    if (!employeeId) {
      setItems([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setItems([]);
    try {
      const res = await listKnowledge(employeeId);
      if (requestId === knowledgeRequest.current) setItems(res.items);
    } catch (e) {
      if (requestId === knowledgeRequest.current) {
        setItems([]);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (requestId === knowledgeRequest.current) setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
    return () => { knowledgeRequest.current += 1; };
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
          error || employeesError
            ? undefined
            : !employeeId
              ? '选择数字员工后查看其学习沉淀'
              : loading
              ? '正在加载学习沉淀…'
              : `共 ${items.length} 条沉淀 · 已同步 ${syncedCount} 条`
        }
        actions={
          <>
            <span id="dw-learning-employee-label">数字员工</span>
            <Select
              aria-labelledby="dw-learning-employee-label"
              placeholder="选择数字员工"
              value={employeeId || undefined}
              optionList={employees.map((employee) => ({ value: employee.employeeId, label: employee.name }))}
              loading={employeesLoading}
              disabled={employeesLoading || !!employeesError}
              onChange={(value) => setEmployeeId(typeof value === 'string' ? value : '')}
              style={{ width: 220 }}
            />
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              disabled={!employeeId}
              onClick={() => void load()}
            >
              刷新
            </Button>
          </>
        }
      />

      {employeesError ? (
        <EmptyState
          illustration="failure"
          title="员工列表加载失败"
          desc={employeesError}
          actions={
            <Button theme="solid" type="primary" onClick={() => void loadEmployees()}>
              重试
            </Button>
          }
        />
      ) : !employeeId ? (
        <EmptyState
          illustration="no-content"
          title="请选择数字员工"
          desc={employeesLoading ? '正在加载员工列表…' : employees.length ? '选择员工后查看其学习沉淀。' : '暂无可选数字员工。'}
        />
      ) : error ? (
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
