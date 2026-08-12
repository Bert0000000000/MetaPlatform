import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from '@douyinfe/semi-ui';
import { listEmployees } from '@/api/dw/employees';
import type { Employee, PageResponse } from '@/api/dw/types';

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listEmployees()
      .then((res: PageResponse<Employee>) => {
        if (mounted) setItems(res.items ?? []);
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
      header={<h2>数字员工列表</h2>}
      dataSource={items}
      emptyContent={<Empty description="暂无数字员工" />}
      renderItem={(item) => (
        <List.Item>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>
              <>
                <Tag>{item.roleCategory}</Tag>
                <Tag color={item.status === 'ACTIVE' ? 'green' : 'grey'}>
                  {item.status}
                </Tag>
                {item.description}
              </>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}