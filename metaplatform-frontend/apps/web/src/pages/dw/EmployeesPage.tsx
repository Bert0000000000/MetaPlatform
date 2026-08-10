import { useEffect, useState } from 'react';
import { List, Tag, Empty, Spin } from 'antd';
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
      bordered={false}
      dataSource={items}
      locale={{ emptyText: <Empty description="暂无数字员工" /> }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={item.name}
            description={
              <>
                <Tag>{item.roleCategory}</Tag>
                <Tag color={item.status === 'ACTIVE' ? 'green' : 'default'}>
                  {item.status}
                </Tag>
                <span style={{ marginLeft: 8 }}>{item.description}</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}