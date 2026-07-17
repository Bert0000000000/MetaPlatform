import { Button, Card, Empty, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { CollaborationTask } from '@/api/collaborations';

interface CollaborationReportProps {
  task: CollaborationTask;
}

export default function CollaborationReport({ task }: CollaborationReportProps) {
  if (!task.finalReport) {
    return (
      <Card>
        <Empty description="暂无报告" />
      </Card>
    );
  }

  const handleDownload = () => {
    const blob = new Blob([task.finalReport!], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collaboration_${task.collaborationId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已下载');
  };

  return (
    <Card
      title="协作报告"
      extra={
        <Button icon={<DownloadOutlined />} onClick={handleDownload}>
          下载 Markdown
        </Button>
      }
    >
      <pre
        style={{
          background: '#fafafa',
          padding: 12,
          borderRadius: 4,
          fontFamily: 'Menlo, Consolas, monospace',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}
      >
        {task.finalReport}
      </pre>
    </Card>
  );
}
