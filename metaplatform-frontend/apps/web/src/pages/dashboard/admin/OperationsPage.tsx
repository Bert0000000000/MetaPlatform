import { useEffect, useMemo, useState } from "react";
import { Button } from '@douyinfe/semi-ui';
import { Card, Input, Space, Table, Tag, Typography } from "@douyinfe/semi-ui";
import { Row, Col } from "@douyinfe/semi-ui/lib/es/grid";
import { ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  getOpsCapacity,
  getOpsHealth,
  getOpsSelfMetrics,
  listAlertRules,
  queryPrometheus,
} from "@/api/admin/operations";
import type { OpsAlertRule, OpsCapacityResponse, OpsHealthReport, OpsSelfMetrics } from "@/types";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";

const { Text } = Typography;

function formatNumber(v: number | undefined, digits = 2): string {
  if (v === undefined || v === null) return "-";
  if (Math.abs(v) >= 1024 * 1024) return (v / (1024 * 1024)).toFixed(digits) + " MB";
  if (Math.abs(v) >= 1024) return (v / 1024).toFixed(digits) + " KB";
  return v.toFixed(digits);
}

// 统计卡片（Statistic 无 Semi 等价物，自建 label + 大数字）
function Stat({ title, value, suffix, prefix, valueStyle }: { title: string; value: number | string; suffix?: React.ReactNode; prefix?: React.ReactNode; valueStyle?: React.CSSProperties }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8, ...valueStyle }}>
        {prefix}
        {value}
        {suffix}
      </div>
    </div>
  );
}

interface PromRow {
  metric?: Record<string, string>;
  value?: [number, string];
}

interface PromResult {
  query: string;
  status: string;
  result_type?: string;
  value?: PromRow[];
  error?: string;
}

export default function OperationsPage() {
  const [health, setHealth] = useState<OpsHealthReport | null>(null);
  const [metrics, setMetrics] = useState<OpsSelfMetrics | null>(null);
  const [rules, setRules] = useState<OpsAlertRule[]>([]);
  const [capacity, setCapacity] = useState<OpsCapacityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [promQuery, setPromQuery] = useState("up");
  const [promResult, setPromResult] = useState<PromResult | null>(null);
  const [promLoading, setPromLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [h, m, r, c] = await Promise.allSettled([
        getOpsHealth(),
        getOpsSelfMetrics(),
        listAlertRules(),
        getOpsCapacity(),
      ]);
      if (h.status === "fulfilled") setHealth(h.value ?? null);
      if (m.status === "fulfilled") setMetrics(m.value ?? null);
      if (r.status === "fulfilled") setRules(r.value ?? []);
      if (c.status === "fulfilled") setCapacity(c.value ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePromQuery = async () => {
    setPromLoading(true);
    try {
      const r = await queryPrometheus(promQuery);
      setPromResult(r as PromResult);
    } finally {
      setPromLoading(false);
    }
  };

  const healthColumns = useMemo(
    () => [
      { title: "组件", dataIndex: "name", render: (v: string) => (<span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v}</span>) },
      { title: "状态", dataIndex: "healthy", render: (v: boolean, r: OpsHealthReport["components"][number]) => (
        <Space><Tag color={v ? "green" : "red"}>{v ? "健康" : "异常"}</Tag><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.detail}</span></Space>
      ) },
      { title: "延迟", dataIndex: "latencyMs", render: (v?: number) => (<span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v != null ? v.toFixed(1) + " ms" : "—"}</span>) },
    ],
    [],
  );

  const ruleColumns = useMemo(
    () => [
      { title: "规则", dataIndex: "alert" },
      { title: "严重度", dataIndex: "severity", render: (v: string) => (<Tag color={v === "critical" ? "red" : "orange"}>{v}</Tag>) },
      { title: "持续时间", dataIndex: "for" },
      { title: "摘要", dataIndex: "summary" },
      { title: "说明", dataIndex: "description", render: (v: string) => (<span style={{ fontSize: 12 }}>{v}</span>) },
    ],
    [],
  );

  return (
    <AdminLayout
      title="运营监控"
      extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
    >
      <StatGrid>
        <StatCard
          label="健康服务"
          value={health ? `${health.summary.healthy} / ${health.summary.total}` : "—"}
          color={health?.overall ? "success" : "destructive"}
        />
        <StatCard label="告警规则" value={rules.length} color="warning" />
        <StatCard
          label="容量"
          value={metrics?.processResidentMemoryBytes !== undefined
            ? formatNumber(metrics.processResidentMemoryBytes, 1)
            : "—"}
        />
        <StatCard
          label="状态"
          value={capacity?.prometheus?.configured ? "运行中" : "待配置"}
          color={capacity?.prometheus?.configured ? "success" : "default"}
        />
      </StatGrid>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Stat
              title="服务健康"
              value={health?.summary.healthy ?? 0}
              suffix={"/ " + (health?.summary.total ?? 0)}
              valueStyle={{ color: health?.overall ? "var(--success)" : "var(--destructive)" }}
            />
            <div style={{ marginTop: 8, color: "var(--muted-foreground)", fontSize: 12 }}>
              {health?.overall ? "所有组件健康" : "存在异常组件"}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Stat title="告警规则" value={rules.length} prefix={<ThunderboltOutlined />} />
            <div style={{ marginTop: 8, color: "var(--muted-foreground)", fontSize: 12 }}>Prometheus 告警规则数</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Stat
              title="Prometheus"
              value={capacity?.prometheus?.configured ? "已连接" : "未连接"}
              valueStyle={{ color: capacity?.prometheus?.configured ? "var(--success)" : "var(--muted-foreground)" }}
            />
            <div style={{ marginTop: 8, color: "var(--muted-foreground)", fontSize: 12 }}>配置 PROM_URL 后可执行即时查询</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="组件健康">
            <Table rowKey="name" size="small" pagination={{ pageSize: 8, showSizeChanger: false }} loading={loading} columns={healthColumns} dataSource={health?.components ?? []} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="mate-tech-obs 自监控指标">
            <Row gutter={8}>
              <Col span={12}><Stat title="CPU 时间" value={formatNumber(metrics?.processCpuSecondsTotal, 3)} /></Col>
              <Col span={12}><Stat title="常驻内存" value={formatNumber(metrics?.processResidentMemoryBytes, 1)} /></Col>
              <Col span={12}><Stat title="GC 对象回收" value={metrics?.pythonGcObjectsCollectedTotal ?? "-"} /></Col>
              <Col span={12}><Stat title="HTTP 请求累计" value={metrics?.httpRequestsTotal ?? "-"} /></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title="告警规则" style={{ marginBottom: 16 }}>
        <Table rowKey="alert" size="small" loading={loading} pagination={{ pageSize: 10, showSizeChanger: false }} columns={ruleColumns} dataSource={rules ?? []} />
      </Card>

      <Card title="Prometheus 即时查询">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <Input value={promQuery} onChange={(v) => setPromQuery(v)} placeholder="PromQL 表达式，如 up" />
          </div>
          <Button theme="solid" type="primary" onClick={handlePromQuery} loading={promLoading}>查询</Button>
        </div>
        {promResult && promResult.status === "unavailable" && (
          <Text type="warning" style={{ marginTop: 8, display: "block" }}>{promResult.error ?? "Prometheus unavailable"}</Text>
        )}
        {promResult && (
          <pre style={{ background: "var(--muted)", padding: 12, borderRadius: 6, fontSize: 12, overflow: "auto", maxHeight: 300, marginTop: 12 }}>
            {JSON.stringify(promResult, null, 2)}
          </pre>
        )}
      </Card>
    </AdminLayout>
  );
}
