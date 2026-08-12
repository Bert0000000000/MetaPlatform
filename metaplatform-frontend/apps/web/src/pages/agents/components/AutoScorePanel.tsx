import { useState } from 'react';
import {
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  Toast,
  Progress,
  Space,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { ThunderboltOutlined, ExperimentOutlined } from '@ant-design/icons';
import { autoScoreConversation, batchAutoScore } from '@/api/dw/evaluations';
import { DIMENSION_META } from '@/api/dw/types';
import type { AutoScoreResult } from '@/api/dw/types';
import DimensionScoreChart from './DimensionScoreChart';

interface AutoScorePanelProps {
  conversationId?: string;
  employeeId?: string;
  onScored?: (result: AutoScoreResult) => void;
}

interface BatchRow {
  key: string;
  conversationId: string;
  overallScore: number;
  mode: string;
  evaluatedAt: string;
  result: AutoScoreResult;
}

/** 根据分数返回 Tag 的颜色 */
function scoreTagColor(s: number): TagColor {
  if (s >= 85) return 'green';
  if (s >= 70) return 'orange';
  return 'red';
}

/** 根据分数返回进度环的描边颜色 */
function scoreStrokeColor(s: number): string {
  if (s >= 85) return 'var(--semi-color-success)';
  if (s >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-danger)';
}

/**
 * 自动评分面板：
 * - 单条对话评分：输入 conversationId 或使用 props.conversationId
 * - 批量评分：基于 employeeId
 * - 展示总分进度环、维度评分折叠列表、评分模型与时间
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
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBatchScore = async () => {
    if (!employeeId) {
      Toast.warning('批量评分需要 employeeId');
      return;
    }
    setBatchLoading(true);
    try {
      const r = await batchAutoScore(employeeId, { limit: 3 });
      setBatchResults(r.results);
      Toast.success(`批量评分完成：${r.scored}/${r.total}`);
    } finally {
      setBatchLoading(false);
    }
  };

  const batchRows: BatchRow[] = batchResults.map((r) => ({
    key: r.conversationId,
    conversationId: r.conversationId,
    overallScore: r.overallScore,
    mode: r.mode,
    evaluatedAt: r.evaluatedAt,
    result: r,
  }));

  return (
    <Space vertical style={{ width: '100%' }} spacing="medium">
      <Card title="自动评分">
        <Space wrap>
          <Input
            placeholder="对话 ID（留空则使用 props.conversationId）"
            value={inputConvId}
            onChange={(v: string) => setInputConvId(v)}
            style={{ width: 320 }}
            showClear
          />
          <Button
            theme="solid"
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={singleLoading}
            onClick={handleSingleScore}
          >
            一键自动评分
          </Button>
          <Button
            icon={<ExperimentOutlined />}
            loading={batchLoading}
            onClick={handleBatchScore}
            disabled={!employeeId}
          >
            批量评分（最近 3 条）
          </Button>
        </Space>
      </Card>

      {result && (
        <Card title="评分结果">
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Card title="总分">
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <Progress
                    type="circle"
                    percent={result.overallScore}
                    stroke={scoreStrokeColor(result.overallScore)}
                    format={(p) => <span style={{ fontSize: 24, fontWeight: 700 }}>{p}</span>}
                  />
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 12, marginBottom: 0 }}
                  >
                    {result.summary}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Model: {result.evaluatorModel} ·{' '}
                    {new Date(result.evaluatedAt).toLocaleString()}
                  </Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">模式：{result.mode}</Tag>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="维度雷达">
                <DimensionScoreChart dimensions={result.dimensions} size={300} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="维度明细">
                <Collapse>
                  {result.dimensions.map((d) => (
                    <Collapse.Panel
                      key={d.dimension}
                      itemKey={d.dimension}
                      header={
                        <Space>
                          <Typography.Text strong>{DIMENSION_META[d.dimension].label}</Typography.Text>
                          <Tag color={scoreTagColor(d.score)}>{d.score}</Tag>
                          {d.weight != null && (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              权重 {(d.weight * 100).toFixed(0)}%
                            </Typography.Text>
                          )}
                        </Space>
                      }
                    >
                      <Space vertical spacing="tight" style={{ width: '100%' }}>
                        {d.reasoning && (
                          <Typography.Paragraph style={{ marginBottom: 0 }}>
                            <Typography.Text type="secondary">理由：</Typography.Text>
                            {d.reasoning}
                          </Typography.Paragraph>
                        )}
                        {d.evidence && d.evidence.length > 0 && (
                          <div>
                            <Typography.Text type="secondary">证据：</Typography.Text>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              {d.evidence.map((e, i) => (
                                <li key={i}>
                                  <Typography.Text style={{ fontSize: 12 }}>{e}</Typography.Text>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </Space>
                    </Collapse.Panel>
                  ))}
                </Collapse>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      {batchResults.length > 0 && (
        <Card title="批量评分结果">
          <Collapse>
            {batchRows.map((row) => (
              <Collapse.Panel
                key={row.key}
                itemKey={row.key}
                header={
                  <Space>
                    <Typography.Text>{row.conversationId}</Typography.Text>
                    <Tag color={scoreTagColor(row.overallScore)}>
                      总分 {row.overallScore}
                    </Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(row.evaluatedAt).toLocaleString()}
                    </Typography.Text>
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col xs={24} md={10}>
                    <DimensionScoreChart dimensions={row.result.dimensions} size={260} />
                  </Col>
                  <Col xs={24} md={14}>
                    <Typography.Paragraph>{row.result.summary}</Typography.Paragraph>
                    <Collapse>
                      {row.result.dimensions.map((d) => (
                        <Collapse.Panel
                          key={d.dimension}
                          itemKey={d.dimension}
                          header={
                            <Space>
                              <Typography.Text strong>{DIMENSION_META[d.dimension].label}</Typography.Text>
                              <Tag>{d.score}</Tag>
                            </Space>
                          }
                        >
                          <Space vertical spacing={4} style={{ width: '100%' }}>
                            {d.reasoning && <Typography.Text>{d.reasoning}</Typography.Text>}
                            {d.evidence && d.evidence.length > 0 && (
                              <ul style={{ margin: 0, paddingLeft: 16 }}>
                                {d.evidence.map((e, i) => (
                                  <li key={i}>
                                    <Typography.Text style={{ fontSize: 12 }}>{e}</Typography.Text>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </Space>
                        </Collapse.Panel>
                      ))}
                    </Collapse>
                  </Col>
                </Row>
              </Collapse.Panel>
            ))}
          </Collapse>
        </Card>
      )}

      {!result && batchResults.length === 0 && (
        <Card>
          <Empty description="点击上方按钮开始自动评分" />
        </Card>
      )}
    </Space>
  );
}
