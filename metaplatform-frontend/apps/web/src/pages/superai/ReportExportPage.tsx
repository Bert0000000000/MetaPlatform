import { useCallback, useState } from 'react';
import { Button, Card, Input, Radio, RadioGroup, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Download } from 'lucide-react';
import { aggregateResults } from '@/api/superai/schedule';
import { PageHeader } from '@/components/skeleton';

type ReportFormat = 'md' | 'pdf' | 'docx' | 'html';

const MIME: Record<ReportFormat, string> = {
  md: 'text/markdown',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html',
};

/**
 * SuperAI · 报告导出。
 *
 * 原页把「报告内容占位」写死成 Blob 直接下载（伪造内容）。这里改为先调用真实的
 * aggregateResults（GET /scheduling/execution/{id}/report）取后端报告原文，再按所选
 * 格式打包下载；拿不到报告就报错，不生成占位内容。
 */
export default function ReportExportPage() {
  const [execId, setExecId] = useState('');
  const [format, setFormat] = useState<ReportFormat>('md');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    const id = execId.trim();
    if (!id) {
      Toast.warning('请输入 Execution ID');
      return;
    }
    setDownloading(true);
    try {
      const content = await aggregateResults(id);
      const blob = new Blob([content], { type: MIME[format] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('已下载');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setDownloading(false);
    }
  }, [execId, format]);

  return (
    <>
      <PageHeader title="报告导出" desc="按 Execution ID 取后端报告原文，选择格式后下载" />

      <Card>
        <div className="mp-exec-col">
          <Input
            value={execId}
            onChange={setExecId}
            placeholder="Execution ID"
            onEnterPress={() => void handleDownload()}
          />
          <RadioGroup
            type="button"
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
          >
            <Radio value="md">Markdown</Radio>
            <Radio value="pdf">PDF</Radio>
            <Radio value="docx">Word</Radio>
            <Radio value="html">HTML</Radio>
          </RadioGroup>
          <span className="mp-exec-chips">
            <Typography.Text type="secondary">当前格式：</Typography.Text>
            <Tag type="light">{format.toUpperCase()}</Tag>
          </span>
          <div className="mp-exec-step-actions">
            <Button
              theme="solid"
              type="primary"
              icon={<Download size={15} strokeWidth={1.5} />}
              loading={downloading}
              onClick={() => void handleDownload()}
            >
              下载
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
