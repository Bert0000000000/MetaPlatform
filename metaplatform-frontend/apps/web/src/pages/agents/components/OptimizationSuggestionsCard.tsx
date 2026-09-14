import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Collapse,
  Radio,
  Row,
  Space,
  Spin,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { generateSuggestions, listSuggestions } from '@/api/dw/evaluations';
import { SUGGESTION_CATEGORY_META, SUGGESTION_PRIORITY_META } from '@/api/dw/types';
import type { OptimizationSuggestion, SuggestionPriority } from '@/api/dw/types';
import { EmptyState } from '@/components/skeleton';
import '../agents.css';

interface OptimizationSuggestionsCardProps {
  employeeId: string;
}

const PERIOD_OPTIONS = [
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '近 90 天', value: '90d' },
];

const PRIORITY_ORDER: Record<SuggestionPriority, number> = { high: 0, medium: 1, low: 2 };

// api/dw/types 的 meta.color 是旧 UI 颜色名，这里映射到 Semi TagColor
const TAG_COLOR_MAP: Record<string, TagColor> = {
  blue: 'blue',
  cyan: 'cyan',
  purple: 'purple',
  geekblue: 'indigo',
  magenta: 'pink',
  gold: 'yellow',
  red: 'red',
  orange: 'orange',
  green: 'green',
  grey: 'grey',
};

/**
 * 优化建议卡片：
 * - 顶部「生成优化建议」按钮 + 周期切换（7d/30d/90d）
 * - 建议按 priority 分组（高/中/低），展开后显示描述、行动、预期影响、关联证据
 *
 * 加载 / 空 / 失败三态互斥；失败给 EmptyState failure + 重试。
 */
export default function OptimizationSuggestionsCard({
  employeeId,
}: OptimizationSuggestionsCardProps) {
  const [period, setPeriod] = useState<string>('7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>();

  const loadList = useCallback(
    async (p: string) => {
      setLoading(true);
      setError('');
      try {
        const list = await listSuggestions(employeeId, { period: p });
        setSuggestions(list);
      } catch (e) {
        setSuggestions([]);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [employeeId],
  );

  useEffect(() => {
    if (!employeeId) {
      setSuggestions([]);
      return;
    }
    void loadList(period);
  }, [employeeId, period, loadList]);

  const handleGenerate = async () => {
    if (!employeeId) {
      Toast.warning('请先选择数字员工');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await generateSuggestions({ employeeId, period });
      setSuggestions(resp.suggestions);
      setGeneratedAt(resp.generatedAt);
      Toast.success(`已生成 ${resp.suggestions.length} 条优化建议`);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
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
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
  )) {
    const bucket = grouped[s.priority];
    // 未登记的优先级归入 medium 桶，避免 grouped[unknown] undefined 崩溃
    (bucket ?? grouped.medium).push(s);
  }

  const renderSuggestionCard = (s: OptimizationSuggestion) => {
    // 后端可能返回前端未登记的新枚举值，这里一律兜底，避免读 undefined.color 崩溃
    const catMeta = SUGGESTION_CATEGORY_META[s.category];
    const priMeta = SUGGESTION_PRIORITY_META[s.priority];
    return (
      <Card
        key={s.id}
        title={
          <span className="mp-agent-line">
            <Typography.Text strong>{s.title}</Typography.Text>
            <span className="mp-agent-chips">
              <Tag color={TAG_COLOR_MAP[catMeta?.color ?? 'grey'] ?? 'grey'} type="light">
                {catMeta?.label ?? s.category}
              </Tag>
              <Tag color={TAG_COLOR_MAP[priMeta?.color ?? 'grey'] ?? 'grey'} type="light">
                优先级：{priMeta?.label ?? s.priority}
              </Tag>
            </span>
          </span>
        }
      >
        <Typography.Paragraph>{s.description}</Typography.Paragraph>
        <Typography.Paragraph>
          <Typography.Text type="tertiary">
            <ArrowRight size={13} strokeWidth={1.5} /> 行动：
          </Typography.Text>
          {s.action}
        </Typography.Paragraph>
        <Typography.Text type="success">预期影响：{s.expectedImpact}</Typography.Text>
        {s.relatedEvidence && s.relatedEvidence.length > 0 ? (
          <div className="mp-agent-chips">
            {s.relatedEvidence.map((e, i) => (
              <Tag key={`${s.id}-ev-${i}`} type="light">
                {e}
              </Tag>
            ))}
          </div>
        ) : null}
      </Card>
    );
  };

  return (
    <Card title="优化建议">
      <Space wrap>
        <Button
          theme="solid"
          type="primary"
          icon={<Lightbulb size={15} strokeWidth={1.5} />}
          loading={loading}
          onClick={() => void handleGenerate()}
          disabled={!employeeId}
        >
          生成优化建议
        </Button>
        <Radio.Group
          type="button"
          value={period}
          onChange={(e) => setPeriod(e.target.value as string)}
          options={PERIOD_OPTIONS}
        />
        {generatedAt ? (
          <Typography.Text type="tertiary" size="small">
            最近生成：{new Date(generatedAt).toLocaleString()}
          </Typography.Text>
        ) : null}
      </Space>

      {error ? (
        <EmptyState
          illustration="failure"
          title="优化建议加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void loadList(period)}>
              重试
            </Button>
          }
        />
      ) : loading && suggestions.length === 0 ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : suggestions.length === 0 ? (
        <EmptyState
          illustration="idle"
          title="暂无优化建议"
          desc="选择周期后点「生成优化建议」，引擎会基于评估结果给出改进项。"
        />
      ) : (
        <Collapse defaultActiveKey={['high']}>
          {(['high', 'medium', 'low'] as SuggestionPriority[]).map((p) => (
            <Collapse.Panel
              key={p}
              itemKey={p}
              header={
                <span className="mp-agent-line">
                  <Typography.Text strong>
                    {SUGGESTION_PRIORITY_META[p].label}优先级建议
                  </Typography.Text>
                  <Tag color={TAG_COLOR_MAP[SUGGESTION_PRIORITY_META[p].color] ?? 'grey'} type="light">
                    {grouped[p].length}
                  </Tag>
                </span>
              }
            >
              {grouped[p].length === 0 ? (
                <EmptyState
                  illustration="no-result"
                  title={`暂无${SUGGESTION_PRIORITY_META[p].label}优先级建议`}
                />
              ) : (
                <Row gutter={[16, 16]}>
                  {grouped[p].map((s) => (
                    <Col span={24} key={s.id}>
                      {renderSuggestionCard(s)}
                    </Col>
                  ))}
                </Row>
              )}
            </Collapse.Panel>
          ))}
        </Collapse>
      )}
    </Card>
  );
}
