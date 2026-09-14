import { Banner, Button } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/skeleton';

/**
 * SuperAI · 并行执行监控。
 *
 * 后端现状（2026-09-14 实测，dev 的 copilot/orchestrator 为 stub）：
 * 只有「启动一次执行」（POST /scheduling/execution/start）与「取最终报告」，
 * 没有「列出正在并行执行的子任务 / 轮询进度」的接口。原页用 setInterval 随机
 * 递增的进度条是纯伪造数据，已删除；这里只如实说明能力缺口，不放假进度。
 * 等后端补上执行监控契约后，再按 Steps/Progress 呈现真实子任务。
 */
export default function ParallelExecutionPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="并行执行监控"
        desc="所有子任务完成后自动汇聚；执行与报告走调度执行面板"
        actions={
          <Button
            theme="solid"
            type="primary"
            icon={<PlayCircle size={15} strokeWidth={1.5} />}
            onClick={() => navigate('/superai/schedules/execute')}
          >
            去执行面板
          </Button>
        }
      />

      <Banner
        type="info"
        closeIcon={null}
        description="当前后端没有「并行子任务实时进度」接口（只有启动执行与取报告），本页不再展示模拟进度。子任务状态请以执行面板返回的真实结果为准。"
      />

      <EmptyState
        illustration="no-content"
        title="没有正在监控的并行执行"
        desc="启动一次调度执行后，子任务结果会在执行面板按后端真实数据呈现。"
      />
    </>
  );
}
