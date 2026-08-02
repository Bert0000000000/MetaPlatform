import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Spin, Typography, Alert, Tag, Space } from 'antd';
import { getAppRuntime } from '@/api/apphub/runtime';
import type { AppRuntime } from '@/api/apphub/types';

const { Title, Text } = Typography;

export default function AppRuntimePage() {
  const { code } = useParams<{ code: string }>();
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 短链模式:先 resolve code → appId,再加载 runtime
    // 简化:如果 code 是 appId 直接用
    const appId = code || '';
    setLoading(true);
    getAppRuntime(appId)
      .then(setRuntime)
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error) return <Alert type="error" message={error} style={{ margin: 24 }} />;
  if (!runtime) return null;

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={3}>{runtime.app_id}</Title>
            <Tag color="blue">v{runtime.version}</Tag>
            <Text type="secondary">{runtime.modules.length} 个模块</Text>
          </div>
          {runtime.render_tree.map((node, i) => (
            <Card key={i} type="inner" title={node.title}>
              <Tag>{node.node_type}</Tag>
              {node.children.length > 0 && (
                <Text type="secondary">{node.children.length} 个子节点</Text>
              )}
            </Card>
          ))}
        </Space>
      </Card>
    </div>
  );
}
