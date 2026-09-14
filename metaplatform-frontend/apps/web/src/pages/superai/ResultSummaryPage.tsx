import { useCallback, useState } from 'react';
import { Banner, Button, Card, Input, Tag, Toast } from '@douyinfe/semi-ui';
import { FileText, Sparkles } from 'lucide-react';
import { aggregateResults } from '@/api/superai/schedule';
import { EmptyState, PageHeader } from '@/components/skeleton';

/**
 * SuperAI · 执行结果汇总。
 *
 * 数据面沿用 src/api/superai/schedule：aggregateResults → GET /scheduling/execution/{id}/report
 * 返回报告文本。这里按行渲染后端原文，不做任何本地拼装或占位。
 */
export default function ResultSummaryPage() {
  const [execId, setExecId] = useState('');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = useCallback(async () => {
    const id = execId.trim();
    if (!id) {
      Toast.warning('请输入 Execution ID');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReport(await aggregateResults(id));
    } catch (e) {
      setReport('');
      setError(e instanceof Error ? e.message : String(e));
      Toast.error('生成汇总失败');
    } finally {
      setLoading(false);
    }
  }, [execId]);

  return (
    <>
      <PageHeader title="执行结果汇总" desc="按 Execution ID 取后端生成的报告原文" />

      <Card title="生成汇总">
        <div className="mp-exec-intent">
          <div className="mp-exec-intent-input">
            <Input
              value={execId}
              onChange={setExecId}
              placeholder="Execution ID"
              onEnterPress={() => void generate()}
            />
          </div>
          <Button
            theme="solid"
            type="primary"
            icon={<Sparkles size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void generate()}
          >
            生成汇总
          </Button>
        </div>
      </Card>

      {error ? (
        <Banner type="danger" closeIcon={null} description={error} />
      ) : report ? (
        <Card
          title={
            <span className="mp-exec-step-head">
              <FileText size={15} strokeWidth={1.5} />
              <span className="mp-exec-step-title">汇总报告</span>
              <Tag type="light">{execId}</Tag>
            </span>
          }
        >
          {report.split('\n').map((line, i) => (
            <div key={i}>
              <span className="mp-exec-step-body">{line.length > 0 ? line : ' '}</span>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState
          illustration="idle"
          title="生成后查看报告"
          desc="输入 Execution ID，点击「生成汇总」拉取后端报告。"
        />
      )}
    </>
  );
}
