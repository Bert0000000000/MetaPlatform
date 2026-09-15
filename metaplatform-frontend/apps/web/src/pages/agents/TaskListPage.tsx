import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Descriptions, Progress, Select, Tag, Toast } from '@douyinfe/semi-ui';
import { Eye, MessageSquare, Plus, RefreshCw } from 'lucide-react';
import { getTaskStats, listTasks } from '@/api/dw/tasks';
import { listEmployees } from '@/api/dw/employees';
import { recordFeedback } from '@/api/dw/learning';
import type {
  Employee,
  EmployeeTask,
  ExecutionResult,
  FeedbackType,
} from '@/api/dw/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import TaskAssignment from './components/TaskAssignment';
import TaskFeedbackModal from './components/TaskFeedbackModal';
import './agents.css';

const PAGE_SIZE = 20;

type TagColorName = 'grey' | 'blue' | 'green' | 'red' | 'amber';

/**
 * 后端 DwEmployeeTask.status 的取值集合比前端 TaskStatus 宽（历史里有 success/error），
 * 这里做超集映射 + 兜底，未知状态原样展示而不是吞掉。
 */
const STATUS_META: Record<string, { label: string; color: TagColorName }> = {
  pending: { label: '待处理', color: 'grey' },
  in_progress: { label: '运行中', color: 'blue' },
  running: { label: '运行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  success: { label: '已完成', color: 'green' },
  done: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  error: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'grey' },
};

const PRIORITY_META: Record<string, { label: string; color: TagColorName }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'amber' },
  low: { label: '低', color: 'grey' },
};

function statusMeta(value: string): { label: string; color: TagColorName } {
  return STATUS_META[value] ?? { label: value, color: 'grey' };
}

/** 后端部分时间字段默认空串（未执行 / 未结束），空值一律显示占位符。 */
function formatTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

/**
 * 任务中心（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 分页）。
 *
 * 数据面沿用 src/api/dw/tasks（listTasks / getTaskStats）与 listEmployees：
 *  - 后端 /dw/employees/tasks 忽略 employeeId 查询参数、按租户返回任务，
 *    因此「数字员工」筛选项在前端按 task.employeeId 过滤，是真过滤而不是摆设；
 *  - 详情走右侧非模态 SheetDetail（完整页 /agents/tasks/:taskId 仍可深链）；
 *  - 反馈沿用 recordFeedback（TaskFeedbackModal 的校验规则与字段名不变）。
 */
export default function TaskListPage() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [stats, setStats] = useState<{ total: number; running: number; completed: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [preview, setPreview] = useState<EmployeeTask | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState<EmployeeTask | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 先取员工，任务的「负责员工」列与筛选都要用它的名字。
      const empRes = await listEmployees({});
      setEmployees(empRes.items ?? []);
      const [taskRes, statsRes] = await Promise.all([listTasks(employeeId), getTaskStats(employeeId)]);
      setTasks(taskRes);
      setStats(statsRes);
    } catch (e) {
      setTasks([]);
      setStats(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, status, employeeId, pageSize]);

  const employeeName = useCallback(
    (id: string) => employees.find((e) => e.employeeId === id)?.name ?? id,
    [employees],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const wantedLabel = status ? statusMeta(status).label : '';
    return tasks.filter((t) => {
      if (employeeId && t.employeeId !== employeeId) return false;
      // 后端 status 是超集（success/error/in_progress），归一化到展示语义再比较
      if (wantedLabel && statusMeta(t.status).label !== wantedLabel) return false;
      if (!kw) return true;
      return (
        t.title.toLowerCase().includes(kw) ||
        (t.description ?? '').toLowerCase().includes(kw) ||
        t.id.toLowerCase().includes(kw)
      );
    });
  }, [tasks, keyword, status, employeeId]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const submitFeedback = useCallback(
    async (values: {
      executionResult: ExecutionResult;
      feedbackType: FeedbackType;
      suggestion: string;
      tags: string[];
    }) => {
      if (!feedbackTask) return;
      setFeedbackLoading(true);
      try {
        await recordFeedback({
          employeeId: feedbackTask.employeeId,
          taskId: feedbackTask.id,
          taskTitle: feedbackTask.title,
          executionResult: values.executionResult,
          feedbackType: values.feedbackType,
          suggestion: values.suggestion,
          tags: values.tags,
        });
        Toast.success(`已记录对「${feedbackTask.title}」的反馈`);
        setFeedbackTask(null);
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setFeedbackLoading(false);
      }
    },
    [feedbackTask],
  );

  const columns = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'title',
        width: 280,
        ellipsis: true,
        render: (_: unknown, row: EmployeeTask) => (
          <span>
            <span className="mp-agent-name" onClick={() => setPreview(row)}>
              {row.title || row.id}
            </span>
            {row.description ? <span className="mp-agent-sub-role"> · {row.description}</span> : null}
          </span>
        ),
      },
      {
        title: '负责员工',
        dataIndex: 'employeeId',
        width: 180,
        ellipsis: true,
        render: (v: string) => <Tag size="small" type="light">{employeeName(v)}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: string) => {
          const meta = statusMeta(v);
          return (
            <Tag size="small" color={meta.color} type="light">
              {meta.label}
            </Tag>
          );
        },
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        width: 100,
        render: (v?: string) =>
          v && PRIORITY_META[v] ? (
            <Tag size="small" color={PRIORITY_META[v].color} type="light">
              {PRIORITY_META[v].label}
            </Tag>
          ) : (
            <span className="mp-agent-line-label">—</span>
          ),
      },
      {
        title: '进度',
        dataIndex: 'progress',
        width: 150,
        render: (v?: number) =>
          typeof v === 'number' ? <Progress percent={Math.round(v)} size="small" /> : <span className="mp-agent-line-label">—</span>,
      },
      {
        title: '创建',
        dataIndex: 'createdAt',
        width: 180,
        ellipsis: true,
        render: (v?: string) => <span className="mp-agent-line-label">{formatTime(v)}</span>,
      },
      {
        title: '完成',
        dataIndex: 'completedAt',
        width: 180,
        ellipsis: true,
        render: (v?: string) => <span className="mp-agent-line-label">{formatTime(v)}</span>,
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 170,
        render: (_: unknown, row: EmployeeTask) => (
          <span className="mp-agent-chips">
            <Button
              theme="borderless"
              type="primary"
              size="small"
              icon={<Eye size={15} strokeWidth={1.5} />}
              onClick={(e) => {
                e.stopPropagation();
                setPreview(row);
              }}
            >
              详情
            </Button>
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              icon={<MessageSquare size={15} strokeWidth={1.5} />}
              onClick={(e) => {
                e.stopPropagation();
                setFeedbackTask(row);
              }}
            >
              反馈
            </Button>
          </span>
        ),
      },
    ],
    [employeeName],
  );

  const empty = error ? (
    <EmptyState
      illustration="failure"
      title="任务列表加载失败"
      desc={error}
      actions={
        <Button theme="solid" type="primary" onClick={() => void load()}>
          重试
        </Button>
      }
    />
  ) : tasks.length === 0 ? (
    <EmptyState
      illustration="no-content"
      title="还没有任务记录"
      desc="数字员工执行任务后，这里会出现任务记录。"
    />
  ) : (
    <EmptyState
      illustration="no-result"
      title="没有匹配的任务"
      desc="调整关键词、状态或负责员工筛选。"
    />
  );

  const desc = stats
    ? `${stats.total} 个任务 · ${stats.running} 运行中 · ${stats.completed} 已完成 · ${stats.failed} 失败`
    : employees.length > 0
      ? `${employees.length} 名数字员工 · 任务记录读取中`
      : '数字员工的任务记录';

  return (
    <>
      <PageHeader
        title="任务中心"
        desc={desc}
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => setAssignOpen(true)}
            >
              分配任务
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索任务标题或 ID…' }}
        filters={
          <>
            <Select
              value={employeeId}
              onChange={(v) => setEmployeeId(v as string)}
              placeholder="全部员工"
            >
              <Select.Option value="">全部员工</Select.Option>
              {employees.map((e) => (
                <Select.Option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                </Select.Option>
              ))}
            </Select>
            <Select value={status} onChange={(v) => setStatus(v as string)} placeholder="全部状态">
              <Select.Option value="">全部状态</Select.Option>
              <Select.Option value="pending">待处理</Select.Option>
              <Select.Option value="running">运行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
          </>
        }
      />

      <DataTablePro<EmployeeTask>
        columns={columns}
        dataSource={paged}
        rowKey="id"
        loading={loading}
        onRow={(row: EmployeeTask) => ({
          onClick: () => setPreview(row),
        })}
        pagination={{
          currentPage: page,
          pageSize,
          total: filtered.length,
          onChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        empty={empty}
      />

      {/* 分配任务：沿用 TaskAssignment 的表单与 listEmployees 调用，收进 E 骨架的抽屉里 */}
      <SheetDetail
        title="分配任务"
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        footer={<Button onClick={() => setAssignOpen(false)}>关闭</Button>}
      >
        <TaskAssignment
          employees={employees}
          onAssigned={() => {
            setAssignOpen(false);
            void load();
          }}
        />
      </SheetDetail>

      {/* 任务详情预检：非模态，表格仍可继续操作 */}
      <SheetDetail
        title={preview ? `任务详情 · ${preview.title}` : '任务详情'}
        open={preview !== null}
        onClose={() => setPreview(null)}
        footer={
          <>
            <Button onClick={() => setPreview(null)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => preview && navigate(`/agents/tasks/${encodeURIComponent(preview.id)}`)}
            >
              打开完整页
            </Button>
          </>
        }
      >
        {preview ? (
          <Descriptions
            row
            data={[
              { key: '任务 ID', value: preview.id },
              { key: '标题', value: preview.title || '—' },
              { key: '负责员工', value: employeeName(preview.employeeId) },
              { key: '状态', value: statusMeta(preview.status).label },
              {
                key: '优先级',
                value: preview.priority ? (PRIORITY_META[preview.priority]?.label ?? preview.priority) : '—',
              },
              { key: '进度', value: typeof preview.progress === 'number' ? `${Math.round(preview.progress)}%` : '—' },
              { key: '创建', value: formatTime(preview.createdAt) },
              { key: '开始', value: formatTime(preview.startedAt) },
              { key: '完成', value: formatTime(preview.completedAt) },
              { key: '结果', value: preview.result || '—' },
              { key: '描述', value: preview.description || '—' },
            ]}
          />
        ) : null}
      </SheetDetail>

      <TaskFeedbackModal
        open={feedbackTask !== null}
        task={feedbackTask}
        onCancel={() => setFeedbackTask(null)}
        onSubmit={submitFeedback}
        loading={feedbackLoading}
      />
    </>
  );
}
