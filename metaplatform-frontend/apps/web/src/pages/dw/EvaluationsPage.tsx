import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
import { listReports, type EvaluationReport } from '@/api/dw/evaluations';

export default function EvaluationsPage() {
  const [items, setItems] = useState<EvaluationReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listReports()
      .then((res: EvaluationReport[]) => {
        if (mounted) setItems(res ?? []);
      })
      .catch(() => {
        if (mounted) setItems([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <Spin tip="加载中" />;
  }

  return (
    <List
      header={<h2>效果评估报告</h2>}
      dataSource={items}
      emptyContent={<Empty description="暂无评估报告" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{`周期 ${item.period} · 评分 ${item.avgQualityScore}`}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>成功率 {(item.successRate * 100).toFixed(0)}%</Tag>
                任务数 {item.totalTasks}
                {item.createdAt}
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}