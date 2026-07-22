import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Collapse,
  Empty,
  message,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import { BulbOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { generateSuggestions, listSuggestions } from '@/api/evaluations';
import {
  SUGGESTION_CATEGORY_META,
  SUGGESTION_PRIORITY_META,
} from '@/types';
import type {
  OptimizationSuggestion,
  SuggestionPriority,
} from '@/types';

interface OptimizationSuggestionsCardProps {
  employeeId: string;
}

const PERIOD_OPTIONS = [
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '近 90 天', value: '90d' },
];

const PRIORITY_ORDER: Record<SuggestionPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * 优化建议卡片：
 * - 顶部「生成优化建议」按钮 + 时间筛选（7d/30d/90d）
 * - 建议列表按 priority 分组（高/中/低），展开后显示描述、行动、预期影响、关联证据
 */
export default function OptimizationSuggestionsCard({
  employeeId,
}: OptimizationSuggestionsCardProps) {
  const [period, setPeriod] = useState<string>('7d');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();

  const loadList = async (p: string) => {
    setLoading(true);
    try {
      const list = await listSuggestions(employeeId, { period: p });
      setSuggestions(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!employeeId) {
      setSuggestions([]);
      return;
    }
    loadList(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, period]);

  const handleGenerate = async () => {
    if (!employeeId) {
      message.warning('请先选择数字员工');
      return;
    }
    setLoading(true);
    try {
      const resp = await generateSuggestions({ employeeId, period });
      setSuggestions(resp.suggestions);
      setGeneratedAt(resp.generatedAt);
      message.success(`已生成 ${resp.suggestions.length} 条优化建议`);
    } finally {
      setLoading(false);
    }
  };

  // 按优先级分组
  const grouped: Record<SuggestionPriority, OptimizationSuggestion[]> = {
    high: [],
    medium: [],
    low: [],
  };
  for (const s of [...suggestions].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  )) {
    grouped[s.priority].push(s);
  }

  const renderSuggestionCard = (s: OptimizationSuggestion) => {
    const catMeta = SUGGESTION_CATEGORY_META[s.category];
    const priMeta = SUGGESTION_PRIORITY_META[s.priority];
    return (
      <Card
        key={s.id}
        size="small"
        style={{ marginBottom: 8 }}
        title={
          <Space wrap>
            <Typography.Text strong>{s.title}</Typography.Text>
            <Tag color={catMeta.color}>{catMeta.label}</Tag>
            <Tag color={priMeta.color}>优先级：{priMeta.label}</Tag>
          </Space>
        }
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text type="secondary">描述：</Typography.Text>
            {s.description}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text type="secondary">
              <ArrowRightOutlined /> 行动：
            </Typography.Text>
            {s.action}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text type="secondary">预期影响：</Typography.Text>
            <Typography.Text type="success">{s.expectedImpact}</Typography.Text>
          </Typography.Paragraph>
          {s.relatedEvidence && s.relatedEvidence.length > 0 && (
            <div>
              <Typography.Text type="secondary">关联证据：</Typography.Text>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {s.relatedEvidence.map((e, i) => (
                  <li key={i}>
                    <Typography.Text style={{ fontSize: 12 }}>{e}</Typography.Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Space>
      </Card>
    );
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card title="优化建议">
        <Space wrap>
          <Button
            type="primary"
            icon={<BulbOutlined />}
            loading={loading}
            onClick={handleGenerate}
            disabled={!employeeId}
          >
            生成优化建议
          </Button>
          <Segmented
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(v) => setPeriod(v as string)}
          />
          {generatedAt && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              最近生成：{new Date(generatedAt).toLocaleString()}
            </Typography.Text>
          )}
        </Space>
      </Card>

      {suggestions.length === 0 ? (
        <Card>
          <Empty description={loading ? '加载中...' : '暂无优化建议，点击上方按钮生成'} />
        </Card>
      ) : (
        <Collapse
          defaultActiveKey={['high']}
          items={(['high', 'medium', 'low'] as SuggestionPriority[]).map((p) => ({
            key: p,
            label: (
              <Space>
                <Typography.Text strong>{SUGGESTION_PRIORITY_META[p].label}优先级</Typography.Text>
                <Tag color={SUGGESTION_PRIORITY_META[p].color}>{grouped[p].length}</Tag>
              </Space>
            ),
            children: grouped[p].length === 0 ? (
              <Empty description={`暂无${SUGGESTION_PRIORITY_META[p].label}优先级建议`} />
            ) : (
              <div>{grouped[p].map(renderSuggestionCard)}</div>
            ),
          }))}
        />
      )}
    </Space>
  );
}
