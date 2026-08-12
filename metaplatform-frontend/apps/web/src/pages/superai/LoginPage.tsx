import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Toast } from '@douyinfe/semi-ui';
import { login } from '@/api/superai/auth';
import type { LoginRequest } from '@/api/superai/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      await login(values);
      Toast.success('登录成功');
      navigate('/chat');
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
        background: 'var(--background)',
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title heading={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          SuperAI
        </Typography.Title>
        <Form
          onSubmit={handleSubmit}
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
