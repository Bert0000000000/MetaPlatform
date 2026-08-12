import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
import { listTasks } from '@/api/dw/tasks';
import type { EmployeeTask } from '@/api/dw/types';

export default function TasksPage() {
  const [items, setItems] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listTasks('')
      .then((res: EmployeeTask[]) => {
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
      header={<h2>任务列表</h2>}
      dataSource={items}
      emptyContent={<Empty description="暂无任务" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>{item.status}</Tag>
                <Tag>{item.priority}</Tag>
                {item.description}
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}