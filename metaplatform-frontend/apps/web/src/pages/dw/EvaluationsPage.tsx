import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from 'antd';
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
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无评估报告" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={`周期 ${item.period} · 评分 ${item.avgQualityScore}`}
            description={
              <>
                <Tag>成功率 {(item.successRate * 100).toFixed(0)}%</Tag>
                <span style={{ marginLeft: 8 }}>任务数 {item.totalTasks}</span>
                <span style={{ marginLeft: 8 }}>{item.createdAt}</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}