import { Button, Card, Typography } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/skeleton';

/**
 * SuperAI · 结果汇聚。
 *
 * 原页只有一段写死的示例 JSON 与一个并不存在的 POST 接口提示（无任何 API 调用）。
 * 这里去掉伪造示例，只如实说明汇聚时机，并把真实可走的入口指向「执行结果汇总」
 * （该页调用真实的 GET /scheduling/execution/{id}/report）。
 */
export default function ResultAggregationPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="结果汇聚" desc="所有子任务完成后自动汇聚为结构化报告" />

      <Card>
        <div className="mp-exec-col">
          <Typography.Text type="secondary">
            系统会在所有子任务完成后自动汇聚，最终生成结构化报告并触发下一步操作。
          </Typography.Text>
          <EmptyState
            illustration="no-content"
            title="没有正在汇聚的执行"
            desc="汇聚由后端自动触发；需要立即取某次执行的报告，请到执行结果汇总。"
          />
          <div className="mp-exec-step-actions">
            <Button
              theme="solid"
              type="primary"
              icon={<FileText size={15} strokeWidth={1.5} />}
              onClick={() => navigate('/superai/plans/result-summary')}
            >
              执行结果汇总
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
