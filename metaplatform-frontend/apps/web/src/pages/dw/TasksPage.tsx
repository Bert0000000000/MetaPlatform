import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from 'antd';
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
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无任务" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={item.title}
            description={
              <>
                <Tag>{item.status}</Tag>
                <Tag>{item.priority}</Tag>
                <span style={{ marginLeft: 8 }}>{item.description}</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}