import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { login } from '@/api/auth';

interface LoginFormValues {
  username: string;
  password: string;
  tenantId: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await login(values);
      message.success('登录成功');
      navigate('/concepts');
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
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          Ontology Studio
        </Typography.Title>
        <Form<LoginFormValues>
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ tenantId: 'default' }}
        >
          <Form.Item
            name="tenantId"
            label="租户 ID"
            rules={[{ required: true, message: '请输入租户 ID' }]}
          >
            <Input placeholder="例如：default" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
