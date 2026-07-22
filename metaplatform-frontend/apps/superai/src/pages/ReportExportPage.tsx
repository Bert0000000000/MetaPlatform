import { useState } from 'react';
import { Button, Card, Input, Radio, Space, Tag, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

export default function ReportExportPage() {
  const [execId, setExecId] = useState('exec-001');
  const [format, setFormat] = useState<'md' | 'pdf' | 'docx' | 'html'>('md');

  const handleDownload = () => {
    const content = `# 报告 (${execId})\n\n报告内容占位。`;
    const mime = format === 'md' ? 'text/markdown' : format === 'html' ? 'text/html' : 'text/plain';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${execId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已下载');
  };

  return (
    <div>
      <Typography.Title level={4}>报告导出</Typography.Title>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            value={execId}
            onChange={(e) => setExecId(e.target.value)}
            placeholder="Execution ID"
          />
          <Radio.Group value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <Radio.Button value="md">Markdown</Radio.Button>
            <Radio.Button value="pdf">PDF</Radio.Button>
            <Radio.Button value="docx">Word</Radio.Button>
            <Radio.Button value="html">HTML</Radio.Button>
          </Radio.Group>
          <Tag>当前格式：{format.toUpperCase()}</Tag>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            下载
          </Button>
        </Space>
      </Card>
    </div>
  );
}
