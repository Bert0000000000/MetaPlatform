import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Spin, Tabs, Tag } from '@douyinfe/semi-ui';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { listTasks } from '@/api/dw/tasks';
import type { EmployeeTask } from '@/api/dw/types';
import { EmptyState, PageHeader } from '@/components/skeleton';
import ExecutionProgress from './components/ExecutionProgress';
import ExecutionTimeline from './components/ExecutionTimeline';
import ReplayPanel from './components/ReplayPanel';
import TaskControls from './components/TaskControls';
import TraceLinkViewer from './components/TraceLinkViewer';
import './agents.css';

type TagColorName = 'grey' | 'blue' | 'green' | 'red';

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
  medium: { label: '中', color: 'grey' },
  low: { label: '低', color: 'grey' },
};

function statusMeta(value: string): { label: string; color: TagColorName } {
  return STATUS_META[value] ?? { label: value, color: 'grey' };
}

function formatTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

/**
 * 任务详情（DESIGN-SPEC §5 版式 D：页头 + 状态 + 分区 + 步骤/时间线/进度）。
 *
 * 数据面：平台没有单任务详情接口，listTasks 是唯一的任务读取面
 * （后端 /dw/employees/tasks 忽略 employeeId、按租户分页返回），因此这里拉一页任务
 * 后按路由参数 taskId 定位；定位不到时如实显示空态，不造示例任务。
 */
export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<EmployeeTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const items = await listTasks('');
      setTask(items.find((t) => t.id === taskId) ?? null);
    } catch (e) {
      setTask(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !task) {
    return (
      <div className="mp-agent-loading">
        <Spin size="middle" />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="任务详情" actions={<Button onClick={() => navigate('/agents/tasks')}>返回任务中心</Button>} />
        <EmptyState
          illustration="failure"
          title="任务详情加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      </>
    );
  }

  if (!task) {
    return (
      <>
        <PageHeader title="任务详情" actions={<Button onClick={() => navigate('/agents/tasks')}>返回任务中心</Button>} />
        <EmptyState
          illustration="no-result"
          title="未找到该任务"
          desc={`任务 ${taskId ?? ''} 不在当前租户的任务记录里。`}
          actions={
            <Button theme="solid" type="primary" onClick={() => navigate('/agents/tasks')}>
              返回任务中心
            </Button>
          }
        />
      </>
    );
  }

  const meta = statusMeta(task.status);

  return (
    <>
      <PageHeader
        title={task.title || task.id}
        desc={`任务 ${task.id} · 负责员工 ${task.employeeId}`}
        actions={
          <>
            <Tag color={meta.color} type="light">
              {meta.label}
            </Tag>
            <Button icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={() => navigate('/agents/tasks')}>
              返回
            </Button>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
          </>
        }
      />

      <Card title="任务概览">
        <Descriptions
          row
          data={[
            {
              key: '优先级',
              value: task.priority ? (PRIORITY_META[task.priority]?.label ?? task.priority) : '—',
            },
            { key: '进度', value: typeof task.progress === 'number' ? `${Math.round(task.progress)}%` : '—' },
            { key: '创建时间', value: formatTime(task.createdAt) },
            { key: '开始时间', value: formatTime(task.startedAt) },
            { key: '完成时间', value: formatTime(task.completedAt) },
            { key: '结果', value: task.result || '—' },
            { key: '描述', value: task.description || '—' },
          ]}
        />
      </Card>

      <Tabs>
        <Tabs.TabPane itemKey="progress" tab="实时进度">
          <ExecutionProgress task={task} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="timeline" tab="执行轨迹">
          <ExecutionTimeline task={task} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="replay" tab="执行回放">
          <ReplayPanel traceId={task.id} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="controls" tab="任务干预">
          <TaskControls task={task} onChange={setTask} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="trace" tab="Trace 链路">
          <TraceLinkViewer traceId={task.id} />
        </Tabs.TabPane>
      </Tabs>
    </>
  );
}
