/**
 * 申请漏斗（访问 -> Demo 点击 -> 表单填写 -> 申请提交）
 *
 * 后端 Pydantic 返回 FunnelStep[]，前端按 conversion 渲染横向条状漏斗：
 *   - 第一阶段 100% 满宽，后续阶段按与上一阶段 conversion 等比缩窄
 *   - 阶梯色板沿用原 antd 主题：蓝/绿/黄/品红
 *
 * 注：本项目未引入 @ant-design/charts，Recharts 没有原生 Funnel；
 * 使用 Semi Progress + 自定义阶梯容器实现，简洁且主题一致。
 */
import { Progress, Space, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import type { FunnelStep } from '@/types/analytics';

const { Text } = Typography;

interface Props {
  data: FunnelStep[];
  loading?: boolean;
}

const STAGE_COLORS: Record<FunnelStep['key'], string> = {
  visit: '#60a5fa',
  demo_click: '#62d178',
  form_fill: '#eab308',
  application_submit: '#f472b6',
};

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function FunnelCard({ data, loading = false }: Props) {
  const safeData = Array.isArray(data) ? data : [];
  const top = safeData[0]?.value ?? 0;
  if (!loading && safeData.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        暂无漏斗数据
      </Text>
    );
  }
  return (
    <Space vertical style={{ width: '100%' }} spacing={14}>
      {safeData.map((step, idx) => {
        const widthPct = top > 0 ? (step.value / top) * 100 : 0;
        const color = STAGE_COLORS[step.key];
        return (
          <div key={step.key}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <Space spacing={8}>
                <Tag color="grey" style={{ marginRight: 0 }}>
                  {idx + 1}
                </Tag>
                <Text style={{ fontSize: 13 }}>{step.label}</Text>
                {idx > 0 && (
                  <Tooltip content="与上一阶段的转化率">
                    <Tag color="blue" style={{ marginRight: 0 }}>
                      转化 {formatPercent(step.conversion)}
                    </Tag>
                  </Tooltip>
                )}
              </Space>
              <Text style={{ fontSize: 13, fontWeight: 600 }}>
                {formatNumber(step.value)}
              </Text>
            </div>
            <div style={{ width: `${Math.max(8, widthPct)}%`, transition: 'width 0.4s ease' }}>
              <Progress
                percent={100}
                showInfo={false}
                stroke={color}
                size="small"
              />
            </div>
          </div>
        );
      })}
    </Space>
  );
}
