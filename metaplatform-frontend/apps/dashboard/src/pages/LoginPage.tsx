import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message, Space, Tag } from "antd";
import { isLoggedIn } from "@/utils/auth";

interface LoginFormValues {
  username: string;
  password: string;
  tenantId: string;
}

const DEFAULT_TENANT = "tenant-default";
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const { post } = await import("@/api/client");
      const res = await post<{
        accessToken: string;
        refreshToken?: string;
        userId: string;
        username: string;
        realName?: string;
        user: { id: string; username: string; email?: string; realName?: string; status?: string };
      }>("/iam/auth/login", values);
      const authMod = await import("@/utils/auth");
      authMod.setToken(res.accessToken);
      const user: import("@/utils/auth").AuthUser = {
        id: res.user?.id ?? res.userId,
        username: res.user?.username ?? res.username,
        tenantId: values.tenantId,
        roles: [],
      };
      authMod.setUser(user);
      message.success("登录成功");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
      }}
    >
      <Card style={{ width: 420 }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
          Mate 工作台
        </Typography.Title>
        <Form<LoginFormValues>
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            tenantId: DEFAULT_TENANT,
            username: DEFAULT_USERNAME,
            password: DEFAULT_PASSWORD,
          }}
        >
          <Form.Item
            name="tenantId"
            label="租户 ID"
            rules={[{ required: true, message: "请输入租户 ID" }]}
          >
            <Input placeholder="例如：tenant-default" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666", textAlign: "center" }}>
          <Space size={4} wrap>
            <span>默认账号：</span>
            <Tag color="blue">{DEFAULT_USERNAME}</Tag>
            <Tag color="blue">{DEFAULT_PASSWORD}</Tag>
            <Tag color="blue">{DEFAULT_TENANT}</Tag>
          </Space>
          <div style={{ marginTop: 4, color: "#999" }}>
            其它种子账号：operator / operator123、auditor / auditor123、zhangsan / demo1234
          </div>
        </div>
      </Card>
    </div>
  );
}
