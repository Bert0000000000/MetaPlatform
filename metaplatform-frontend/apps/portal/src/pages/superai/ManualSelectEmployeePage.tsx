import { useState } from 'react';
import { Card, Space, Tag, Typography, Transfer, Button } from 'antd';
import type { TransferProps } from 'antd';

const MOCK = Array.from({ length: 15 }).map((_, i) => ({
  key: `emp-${i + 1}`,
  title: `数字员工 ${i + 1}`,
  description: `用于 ${['财务', 'HR', '数据', '法务', '客服'][i % 5]} 场景`,
}));

export default function ManualSelectEmployeePage() {
  const [targetKeys, setTargetKeys] = useState<string[]>(['emp-1', 'emp-5']);

  const handleChange: TransferProps['onChange'] = (keys) => {
    setTargetKeys(keys.map(String));
  };

  return (
    <div>
      <Typography.Title level={4}>手动选择员工</Typography.Title>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Transfer
            dataSource={MOCK}
            titles={['可选', '已选']}
            targetKeys={targetKeys}
            onChange={handleChange}
            render={(item) => item.title}
          />
          <div>
            <Typography.Text>已选择：</Typography.Text>
            <Space>
              {targetKeys.length === 0 ? <Tag>无</Tag> :
                targetKeys.map((k) => <Tag key={k} color="blue">{k}</Tag>)}
            </Space>
          </div>
          <Button type="primary" disabled={targetKeys.length === 0}>
            确认选择
          </Button>
        </Space>
      </Card>
    </div>
  );
}