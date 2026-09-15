import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Spin, Tag, TextArea, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { RefreshCw, Sparkles } from 'lucide-react';
import { detectIntent, listIntentHistory, type ScheduleIntent } from '@/api/superai/schedule';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';

/**
 * SuperAI · 调度意图识别。
 *
 * 数据面沿用 src/api/superai/schedule：detectIntent（POST /scheduling/intent/detect）+
 * listIntentHistory（GET /scheduling/intents）。
 * detectIntent 的返回按后端字段防御性读取，缺失时不编造置信度；历史接口失败时如实报错。
 */
export default function ScheduleIntentPage() {
  const [intents, setIntents] = useState<ScheduleIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setHistoryError('');
    try {
      const res = await listIntentHistory();
      setIntents(Array.isArray(res) ? res : []);
    } catch (e) {
      setIntents([]);
      setHistoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDetect = useCallback(async () => {
    const value = text.trim();
    if (!value) {
      Toast.warning('请输入一句话');
      return;
    }
    setSubmitting(true);
    try {
      const i = (await detectIntent(value)) as unknown as {
        detectedIntent?: string;
        confidence?: number;
      };
      const label = i.detectedIntent ?? 'unknown';
      const confidence =
        typeof i.confidence === 'number' ? `，置信度 ${(i.confidence * 100).toFixed(0)}%` : '';
      Toast.success(`识别为 ${label}${confidence}`);
      setText('');
      void load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [text, load]);

  const columns: ColumnProps<ScheduleIntent>[] = useMemo(
    () => [
      { title: '原话', dataIndex: 'rawUtterance', ellipsis: true },
      {
        title: '识别结果',
        dataIndex: 'detectedIntent',
        width: 110,
        render: (v: string) => (
          <Tag size="small" type="light" color={v === 'scheduled' ? 'blue' : 'green'}>
            {v === 'scheduled' ? '定时' : v === 'immediate' ? '即时' : v || '—'}
          </Tag>
        ),
      },
      {
        title: '置信度',
        dataIndex: 'confidence',
        width: 100,
        render: (v: number) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—'),
      },
      {
        title: '匹配员工',
        dataIndex: 'detectedEmployees',
        render: (v: string[]) => (
          <span className="mp-exec-chips">
            {(v ?? []).map((e) => (
              <Tag key={e} size="small" type="light" color="purple">
                {e}
              </Tag>
            ))}
          </span>
        ),
      },
      {
        title: '匹配时间',
        dataIndex: 'matchedAt',
        width: 180,
        render: (v?: string) => (v ? new Date(v).toLocaleString() : '—'),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="调度意图识别"
        desc="输入一句话，识别是「定时」还是「即时」，并匹配可用员工"
      />

      <Card title="输入一句话">
        <div className="mp-exec-col">
          <TextArea
            rows={3}
            value={text}
            onChange={(v) => setText(v)}
            placeholder="例如：每周一早上发邮件给我本周团队数据…"
          />
          <div className="mp-exec-step-actions">
            <Button
              theme="solid"
              type="primary"
              icon={<Sparkles size={15} strokeWidth={1.5} />}
              loading={submitting}
              onClick={() => void handleDetect()}
            >
              识别
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="历史记录"
        headerExtraContent={
          <Button
            icon={<RefreshCw size={14} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      >
        {historyError ? (
          <EmptyState
            illustration="failure"
            title="历史记录加载失败"
            desc={historyError}
            actions={
              <Button theme="solid" type="primary" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : loading && intents.length === 0 ? (
          <div className="mp-exec-loading">
            <Spin size="middle" />
          </div>
        ) : (
          <DataTablePro<ScheduleIntent>
            columns={columns}
            dataSource={intents}
            rowKey="intentId"
            loading={loading}
            empty={
              <EmptyState
                illustration="no-content"
                title="还没有历史"
                desc="识别一次意图后，记录会出现在这里。"
              />
            }
          />
        )}
      </Card>
    </>
  );
}
