import { useState } from 'react';
import { Button, Card, Input, Radio, RadioGroup, Space, Tag, Typography, Toast } from '@douyinfe/semi-ui';
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
    Toast.success('已下载');
  };

  return (
    <div>
      <Typography.Title heading={4}>报告导出</Typography.Title>

      <Card>
        <Space vertical style={{ width: '100%' }}>
          <Input
            value={execId}
            onChange={(v) => setExecId(v)}
            placeholder="Execution ID"
          />
          <RadioGroup type="button" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <Radio value="md">Markdown</Radio>
            <Radio value="pdf">PDF</Radio>
            <Radio value="docx">Word</Radio>
            <Radio value="html">HTML</Radio>
          </RadioGroup>
          <Tag>当前格式：{format.toUpperCase()}</Tag>
          <Button
            theme="solid"
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
