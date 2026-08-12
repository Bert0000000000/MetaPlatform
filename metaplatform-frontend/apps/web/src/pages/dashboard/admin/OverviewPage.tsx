import { Card, Tag } from "@douyinfe/semi-ui";
import { Row, Col } from "@douyinfe/semi-ui/lib/es/grid";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserOutlined,
  SafetyOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  SettingOutlined,
  MonitorOutlined,
} from "@ant-design/icons";
import { listUsers } from "@/api/admin";
import { listRoles } from "@/api/admin/permissions";
import { listConfigs } from "@/api/admin/configs";
import { listAuditLogs } from "@/api/admin/logs";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";
import { PageContainer, SectionCard } from "@mate/shared";

interface CardItem {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
  color: string;
  count?: number;
  countLabel?: string;
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});

  useEffect(() => {
    (async () => {
      try {
        const [users, roles, configs, audit] = await Promise.allSettled([
          listUsers({ pageSize: 1 }),
          listRoles({ pageSize: 1 }),
          listConfigs({ pageSize: 1 }),
          listAuditLogs({ pageSize: 1 }),
        ]);
        const next: Record<string, number | undefined> = {};
        if (users.status === "fulfilled") next.users = users.value.total;
        if (roles.status === "fulfilled") next.permissions = roles.value.total;
        if (configs.status === "fulfilled") next.configs = configs.value.total;
        if (audit.status === "fulfilled") next.logs = audit.value.total;
        setCounts(next);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const cards: CardItem[] = [
    { key: "users", title: "用户管理", description: "用户 CRUD / 启停 / 密码重置 / 批量导入", path: "/admin/users", icon: <UserOutlined />, color: "#1677ff", count: counts.users, countLabel: "用户" },
    { key: "permissions", title: "权限管理", description: "角色 / 权限矩阵 / 用户绑定", path: "/admin/permissions", icon: <SafetyOutlined />, color: "#722ed1", count: counts.permissions, countLabel: "角色" },
    { key: "orgs", title: "组织管理", description: "组织树 / 岗位 / 调岗", path: "/admin/orgs", icon: <ApartmentOutlined />, color: "#13c2c2" },
    { key: "logs", title: "日志管理", description: "审计日志 / 导出 CSV", path: "/admin/logs", icon: <FileTextOutlined />, color: "#fa8c16", count: counts.logs, countLabel: "条" },
    { key: "configs", title: "系统配置", description: "SSO / LICENSE / 消息渠道 / 限流", path: "/admin/configs", icon: <SettingOutlined />, color: "#52c41a", count: counts.configs, countLabel: "项" },
    { key: "operations", title: "运营监控", description: "健康大盘 / 容量 / 告警", path: "/admin/operations", icon: <MonitorOutlined />, color: "#eb2f96" },
  ];

  return (
    <AdminLayout title="后台管理">
      <StatGrid>
        <StatCard label="用户总数" value={counts.users ?? "—"} />
        <StatCard label="角色总数" value={counts.permissions ?? "—"} />
        <StatCard label="今日日志" value={counts.logs ?? "—"} color="warning" />
        <StatCard label="系统状态" value="正常" color="success" />
      </StatGrid>
      <PageContainer title="总览">
        <SectionCard title="功能模块">
          <Row gutter={[16, 16]}>
            {cards.map((c) => (
              <Col key={c.key} xs={24} sm={12} md={8} lg={8} xl={6}>
                <div style={{ cursor: 'pointer', height: '100%' }} onClick={() => navigate(c.path)}>
                  <Card shadows="hover" bodyStyle={{ padding: 16 }} style={{ borderRadius: 8, height: '100%' }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: c.color + "22", color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                      {c.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 16, fontWeight: 600 }}>{c.title}</span>
                        {c.count !== undefined && (
                          <Tag color="blue">{c.count} {c.countLabel}</Tag>
                        )}
                      </div>
                      <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 6 }}>{c.description}</div>
                    </div>
                  </div>
                </Card>
                </div>
              </Col>
            ))}
          </Row>
        </SectionCard>
        <SectionCard title="FR-DASH-006 模块清单" style={{ marginTop: 16 }}>
          <ul style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
            <li><b>FR-DASH-006-01 用户管理</b>（P0）：CRUD、状态启用/禁用、密码重置、批量导入（CSV）、登录日志</li>
            <li><b>FR-DASH-006-02 权限管理</b>（P0）：角色 CRUD、用户-角色绑定、权限矩阵</li>
            <li><b>FR-DASH-006-03 组织管理</b>（P1）：组织树、岗位、汇报关系、人员调岗</li>
            <li><b>FR-DASH-006-04 日志管理</b>（P1）：审计日志查询、导出 CSV、详情</li>
            <li><b>FR-DASH-006-05 系统配置</b>（P1）：SSO / LICENSE / 消息渠道 / 限流阈值等维护</li>
            <li><b>FR-DASH-006-06 运营监控</b>（P2）：系统运行状态大盘、容量监控、告警列表</li>
          </ul>
        </SectionCard>
      </PageContainer>
    </AdminLayout>
  );
}
