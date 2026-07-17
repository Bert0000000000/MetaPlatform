import { useEffect, useState } from 'react';
import {
  Card,
  Empty,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  listRelationInstances,
  listRelationTypes,
} from '@/api/relations';
import type { RelationInstance, RelationType } from '@/api/relations';

export default function RelationInstancePage() {
  const [instances, setInstances] = useState<RelationInstance[]>([]);
  const [types, setTypes] = useState<RelationType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listRelationInstances(), listRelationTypes()]).then(([ins, t]) => {
      setInstances(ins);
      setTypes(t.items);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <Typography.Title level={4}>关系实例</Typography.Title>
      <Card>
        {instances.length === 0 && !loading ? (
          <Empty description="还没有关系实例" />
        ) : (
          <Table
            rowKey="relationInstanceId"
            dataSource={instances}
            loading={loading}
            pagination={{ pageSize: 15 }}
            columns={[
              {
                title: '关系类型',
                dataIndex: 'relationTypeId',
                render: (v) => {
                  const t = types.find((x) => x.relationTypeId === v);
                  return t ? <Tag color="blue">{t.name}</Tag> : <Tag>{v}</Tag>;
                },
              },
              { title: '源实体', dataIndex: 'sourceEntityId' },
              { title: '目标实体', dataIndex: 'targetEntityId' },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                render: (v) => (v ? new Date(v).toLocaleString() : '-'),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
