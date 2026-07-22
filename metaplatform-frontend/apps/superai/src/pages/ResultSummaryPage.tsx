import { useState } from 'react';
import { Button, Card, Empty, Input, Space, Typography, message } from 'antd';
import { ThunderboltOutlined, FileTextOutlined } from '@ant-design/icons';
import { aggregateResults } from '@/api/schedule';

export default function ResultSummaryPage() {
  const [execId, setExecId] = useState('exec-001');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!execId.trim()) {
      message.warning('请输入 Execution ID');
      return;
    }
    setLoading(true);
    try {
      const r = await aggregateResults(execId);
      setReport(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4}>执行结果汇总</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input
            value={execId}
            onChange={(e) => setExecId(e.target.value)}
            style={{ width: 320 }}
            placeholder="Execution ID"
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleGenerate}
          >
            生成汇总
          </Button>
        </Space>
      </Card>

      {report ? (
        <Card title={<><FileTextOutlined /> 汇总报告</>}>
          <pre style={codeStyle}>{report}</pre>
        </Card>
      ) : (
        <Empty description="生成后查看报告" />
      )}
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  background: '#fafafa',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  margin: 0,
};
