import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Select,
  Slider,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { getTraceDetail, type ObsSpan, type TraceDetail } from '@/api/obs';

interface ReplayPlayerProps {
  traceId: string;
}

export type ReplayStepType = 'llm' | 'tool' | 'system';

export interface ReplayStep {
  index: number;
  spanId: string;
  type: ReplayStepType;
  title: string;
  subtitle: string;
  timestamp: number;
  durationUs: number;
  input?: string;
  output?: string;
  tags?: Record<string, unknown>;
  status: string;
}

const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
];

function classifySpan(span: ObsSpan): ReplayStepType {
  const tags = span.tags || {};
  const component = String(tags.component || '').toLowerCase();
  const op = (span.operationName || '').toLowerCase();
  if (component === 'llm' || tags['llm.model'] || op.includes('llm') || op.includes('chat')) {
    return 'llm';
  }
  if (component === 'tool' || tags['tool.name'] || op.includes('tool')) {
    return 'tool';
  }
  return 'system';
}

function extractText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractInputOutput(span: ObsSpan): { input?: string; output?: string } {
  const tags = span.tags || {};
  const input = tags['llm.prompt'] ?? tags['tool.input'] ?? tags['input'] ?? undefined;
  const output = tags['llm.completion'] ?? tags['tool.output'] ?? tags['output'] ?? undefined;

  if (input !== undefined || output !== undefined) {
    return { input: extractText(input), output: extractText(output) };
  }

  const completionLog = span.logs?.find(
    (log) =>
      log.fields?.event === 'completion' ||
      log.fields?.event === 'tool.result' ||
      log.event === 'completion' ||
      log.event === 'tool.result',
  );
  if (completionLog) {
    return {
      output: extractText(completionLog.fields ?? completionLog),
    };
  }

  return {};
}

function buildSteps(trace: TraceDetail): ReplayStep[] {
  const baseTime = trace.startTime
    ? new Date(trace.startTime).getTime() * 1000
    : Math.min(...trace.spans.map((s) => s.startTimeUs));
  return trace.spans
    .slice()
    .sort((a, b) => a.startTimeUs - b.startTimeUs)
    .map((span, idx) => {
      const type = classifySpan(span);
      const tags = span.tags || {};
      const name =
        type === 'llm'
          ? String(tags['llm.model'] || span.operationName || 'LLM 调用')
          : type === 'tool'
            ? String(tags['tool.name'] || span.operationName || '工具调用')
            : span.operationName || '系统调用';
      const { input, output } = extractInputOutput(span);
      return {
        index: idx,
        spanId: span.spanId,
        type,
        title: name,
        subtitle: `${span.serviceName} · ${span.spanId.slice(0, 8)}`,
        timestamp: span.startTimeUs - baseTime,
        durationUs: span.durationUs,
        input,
        output,
        tags,
        status: span.status,
      };
    });
}

function formatDuration(us: number): string {
  if (us < 1000) return `${us}μs`;
  if (us < 1_000_000) return `${(us / 1000).toFixed(2)}ms`;
  return `${(us / 1_000_000).toFixed(2)}s`;
}

function formatRelativeTime(us: number): string {
  if (us < 1000) return `${us}μs`;
  if (us < 1_000_000) return `${(us / 1000).toFixed(0)}ms`;
  return `${(us / 1_000_000).toFixed(2)}s`;
}

export default function ReplayPlayer({ traceId }: ReplayPlayerProps) {
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLoading(true);
    getTraceDetail(traceId)
      .then(setTrace)
      .finally(() => setLoading(false));
  }, [traceId]);

  const steps = useMemo(() => (trace ? buildSteps(trace) : []), [trace]);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const step = steps[current];
    const durationMs = Math.max(500, (step.durationUs / 1000) / speed);
    intervalRef.current = setInterval(() => {
      setCurrent((c) => {
        if (c >= steps.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, durationMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, current, steps, speed]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (!trace || steps.length === 0) {
    return <Empty description="未找到 Trace 回放数据" />;
  }

  const step = steps[current];
  const marks: Record<number, string> = {};
  steps.forEach((_, idx) => {
    if (idx === 0 || idx === steps.length - 1) {
      marks[idx] = idx === 0 ? '开始' : '结束';
    }
  });

  const colorMap: Record<ReplayStepType, string> = {
    llm: 'green',
    tool: 'purple',
    system: 'blue',
  };

  return (
    <Card title={`执行回放 - ${trace.traceId}`}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <Button
              icon={<StepBackwardOutlined />}
              disabled={current === 0}
              onClick={() => setCurrent(Math.max(0, current - 1))}
            />
            <Button
              type="primary"
              icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? '暂停' : '播放'}
            </Button>
            <Button
              icon={<StepForwardOutlined />}
              disabled={current >= steps.length - 1}
              onClick={() => setCurrent(Math.min(steps.length - 1, current + 1))}
            />
            <Select
              value={speed}
              options={SPEED_OPTIONS}
              onChange={setSpeed}
              style={{ width: 80 }}
            />
          </Space>
          <Typography.Text type="secondary">
            步骤 {current + 1} / {steps.length} · 总耗时 {formatDuration(trace.durationUs)}
          </Typography.Text>
        </Space>

        <Slider
          value={current}
          min={0}
          max={steps.length - 1}
          step={1}
          onChange={(v) => {
            setCurrent(v as number);
            setPlaying(false);
          }}
          marks={marks}
          tooltip={{ formatter: (v) => `步骤 ${(v as number) + 1}` }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card type="inner" size="small" title="时间轴">
            <Timeline
              items={steps.map((s) => ({
                color: s.index === current ? 'red' : colorMap[s.type],
                children: (
                  <div
                    style={{
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 4,
                      background: s.index === current ? '#fff2f0' : 'transparent',
                    }}
                    onClick={() => {
                      setCurrent(s.index);
                      setPlaying(false);
                    }}
                  >
                    <Space>
                      <Tag color={colorMap[s.type]}>
                        {s.type === 'llm' ? 'AI' : s.type === 'tool' ? '工具' : '系统'}
                      </Tag>
                      <Typography.Text strong={s.index === current}>{s.title}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        +{formatRelativeTime(s.timestamp)}
                      </Typography.Text>
                    </Space>
                  </div>
                ),
              }))}
            />
          </Card>

          <Card type="inner" size="small" title={`当前步骤：${step.title}`}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Tag color={colorMap[step.type]}>
                  {step.type === 'llm' ? 'AI 调用' : step.type === 'tool' ? '工具调用' : '系统调用'}
                </Tag>
                <Tag color={step.status === 'ERROR' ? 'error' : 'success'}>{step.status}</Tag>
                <Typography.Text type="secondary">{step.subtitle}</Typography.Text>
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                耗时 {formatDuration(step.durationUs)} · 相对开始时间{' '}
                {formatRelativeTime(step.timestamp)}
              </Typography.Text>

              {step.input && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    输入
                  </Typography.Text>
                  <pre
                    style={{
                      margin: '4px 0 0 0',
                      padding: 8,
                      background: '#f6ffed',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      maxHeight: 160,
                      overflow: 'auto',
                    }}
                  >
                    {step.input}
                  </pre>
                </div>
              )}

              {step.output && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    输出
                  </Typography.Text>
                  <pre
                    style={{
                      margin: '4px 0 0 0',
                      padding: 8,
                      background: '#f0f5ff',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      maxHeight: 160,
                      overflow: 'auto',
                    }}
                  >
                    {step.output}
                  </pre>
                </div>
              )}

              {!step.input && !step.output && (
                <Typography.Text type="secondary">该步骤暂无输入/输出明细</Typography.Text>
              )}
            </Space>
          </Card>
        </div>
      </Space>
    </Card>
  );
}
