import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Toast } from '@douyinfe/semi-ui';
import { login } from '@/api/mcphub/auth';
import type { LoginRequest } from '@/api/mcphub/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      await login(values);
      Toast.success('登录成功');
      navigate('/tools');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--muted)',
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title heading={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          MCP 服务中心
        </Typography.Title>
        <Form
          onSubmit={(values) => handleSubmit(values as LoginRequest)}
          initValues={{ tenantId: 'default' }}
        >
          <Form.Input
            field="tenantId"
            label="租户 ID"
            rules={[{ required: true, message: '请输入租户 ID' }]}
            placeholder="例如：default"
          />
          <Form.Input
            field="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
            placeholder="请输入用户名"
          />
          <Form.Input
            field="password"
            label="密码"
            mode="password"
            rules={[{ required: true, message: '请输入密码' }]}
            placeholder="请输入密码"
          />
          <Button theme="solid" type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
