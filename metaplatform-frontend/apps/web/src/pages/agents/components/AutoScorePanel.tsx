import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Input,
  Progress,
  Row,
  Space,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { FlaskConical, Zap } from 'lucide-react';
import { autoScoreConversation, batchAutoScore } from '@/api/dw/evaluations';
import { DIMENSION_META } from '@/api/dw/types';
import type { AutoScoreResult, DimensionScore } from '@/api/dw/types';
import { DataTablePro, EmptyState, SheetDetail } from '@/components/skeleton';
import '../agents.css';

interface AutoScorePanelProps {
  conversationId?: string;
  employeeId?: string;
  onScored?: (result: AutoScoreResult) => void;
}

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

/** 分数 → Semi Tag 预设色。 */
function scoreTagColor(s: number): TagColor {
  if (s >= 85) return 'green';
  if (s >= 70) return 'orange';
  return 'red';
}

/** 分数 → 进度条描边色（只取 DSM 主题令牌）。 */
function scoreStrokeColor(s: number): string {
  if (s >= 85) return 'var(--semi-color-success)';
  if (s >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-danger)';
}

/** 六维评分条：每维一行（标签 / Progress / 分值 Tag），无 SVG、无内联样式。 */
function DimensionBars({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <Row gutter={[12, 16]}>
      {dimensions.map((d) => {
        // 后端可能返回前端未登记的维度枚举，统一兜底
        const label = DIMENSION_META[d.dimension]?.label ?? d.dimension;
        return (
          <Col span={24} key={d.dimension}>
            <Row gutter={12} type="flex" align="middle">
              <Col span={6}>
                <Typography.Text>{label}</Typography.Text>
              </Col>
              <Col span={14}>
                <Progress
                  percent={d.score}
                  stroke={scoreStrokeColor(d.score)}
                  showInfo={false}
                  aria-label={`${label} ${d.score} 分`}
                />
              </Col>
              <Col span={4}>
                <Tag color={scoreTagColor(d.score)}>{d.score}</Tag>
              </Col>
            </Row>
            {d.reasoning ? (
              <Typography.Paragraph type="tertiary" size="small">
                {d.reasoning}
              </Typography.Paragraph>
            ) : null}
            {d.evidence && d.evidence.length > 0 ? (
              <div className="mp-agent-chips">
                {d.evidence.map((e, i) => (
                  <Tag key={`${d.dimension}-ev-${i}`} type="light">
                    {e}
                  </Tag>
                ))}
              </div>
            ) : null}
          </Col>
        );
      })}
    </Row>
  );
}

/**
 * 自动评分面板：
 * - 单条对话评分：输入 conversationId 或使用 props.conversationId
 * - 批量评分：基于 employeeId
 * - 结果展示总分 Progress 环 + 维度 Progress 条（不再手绘雷达 SVG）
 *
 * 交互失败一律 Toast.error；未评分时给 EmptyState，不预置任何示例分数。
 */
export default function AutoScorePanel({
  conversationId,
  employeeId,
  onScored,
}: AutoScorePanelProps) {
  const [singleLoading, setSingleLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [result, setResult] = useState<AutoScoreResult | null>(null);
  const [batchResults, setBatchResults] = useState<AutoScoreResult[]>([]);
  const [inputConvId, setInputConvId] = useState<string>(conversationId ?? '');
  const [preview, setPreview] = useState<AutoScoreResult | null>(null);

  const handleSingleScore = async () => {
    const targetId = inputConvId.trim() || conversationId;
    if (!targetId) {
      Toast.warning('请输入或通过 props 提供对话 ID');
      return;
    }
    setSingleLoading(true);
    try {
      const r = await autoScoreConversation(targetId);
      setResult(r);
      onScored?.(r);
      Toast.success(`评分完成：总分 ${r.overallScore}`);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBatchScore = async () => {
    if (!employeeId) {
      Toast.warning('批量评分需要先选择数字员工');
      return;
    }
    setBatchLoading(true);
    try {
      const r = await batchAutoScore(employeeId, { limit: 3 });
      setBatchResults(r.results);
      Toast.success(`批量评分完成：${r.scored}/${r.total}`);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBatchLoading(false);
    }
  };

  const batchColumns: SemiColumns<AutoScoreResult> = [
    { title: '对话', dataIndex: 'conversationId' },
    {
      title: '总分',
      dataIndex: 'overallScore',
      width: 100,
      render: (v: number) => <Tag size="small" color={scoreTagColor(v)}>{v}</Tag>,
    },
    { title: '评分模式', dataIndex: 'mode', width: 110 },
    { title: '评分模型', dataIndex: 'evaluatorModel', ellipsis: true },
    {
      title: '评分时间',
      dataIndex: 'evaluatedAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, r: AutoScoreResult) => (
        <Button theme="borderless" type="primary" size="small" onClick={() => setPreview(r)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card title="自动评分">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={10}>
              <Input
                placeholder="对话 ID（留空则使用当前选中的对话）"
                value={inputConvId}
                onChange={(v: string) => setInputConvId(v)}
                showClear
                prefix={<Zap size={15} strokeWidth={1.5} />}
              />
            </Col>
            <Col xs={24} md={14}>
              <Space wrap>
                <Button
                  theme="solid"
                  type="primary"
                  loading={singleLoading}
                  onClick={() => void handleSingleScore()}
                >
                  一键自动评分
                </Button>
                <Button
                  icon={<FlaskConical size={15} strokeWidth={1.5} />}
                  loading={batchLoading}
                  onClick={() => void handleBatchScore()}
                  disabled={!employeeId}
                >
                  批量评分（最近 3 条）
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </Col>

      {result ? (
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card title="总分">
                <Progress
                  type="circle"
                  percent={result.overallScore}
                  width={132}
                  stroke={scoreStrokeColor(result.overallScore)}
                  format={(p) => `${p ?? 0}`}
                  aria-label="自动评分总分"
                />
                <Typography.Paragraph type="secondary">{result.summary}</Typography.Paragraph>
                <Descriptions
                  row
                  data={[
                    { key: '评分模型', value: result.evaluatorModel },
                    { key: '评分模式', value: result.mode },
                    { key: '评分时间', value: new Date(result.evaluatedAt).toLocaleString() },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} md={16}>
              <Card title="维度评分">
                <DimensionBars dimensions={result.dimensions} />
              </Card>
            </Col>
          </Row>
        </Col>
      ) : null}

      {batchResults.length > 0 ? (
        <Col span={24}>
          <Card title="批量评分结果">
            <DataTablePro<AutoScoreResult>
              rowKey="conversationId"
              dataSource={batchResults}
              columns={batchColumns}
              empty={<EmptyState illustration="no-result" title="本批没有评分结果" />}
            />
          </Card>
        </Col>
      ) : null}

      {!result && batchResults.length === 0 ? (
        <Col span={24}>
          <Card>
            <EmptyState
              illustration="idle"
              title="尚未开始评分"
              desc="填入对话 ID 做单条评分，或对当前员工批量评分。"
            />
          </Card>
        </Col>
      ) : null}

      <SheetDetail
        title={preview ? `评分详情 · ${preview.conversationId}` : '评分详情'}
        open={preview !== null}
        onClose={() => setPreview(null)}
        footer={<Button onClick={() => setPreview(null)}>关闭</Button>}
      >
        {preview ? (
          <>
            <Descriptions
              row
              data={[
                { key: '总分', value: String(preview.overallScore) },
                { key: '评分模式', value: preview.mode },
                { key: '评分模型', value: preview.evaluatorModel },
                { key: '评分时间', value: new Date(preview.evaluatedAt).toLocaleString() },
              ]}
            />
            <Typography.Paragraph>{preview.summary}</Typography.Paragraph>
            <DimensionBars dimensions={preview.dimensions} />
          </>
        ) : null}
      </SheetDetail>
    </Row>
  );
}
