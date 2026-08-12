import { useState } from 'react';
import { Card, Space, Tag, Typography, Transfer, Button } from '@douyinfe/semi-ui';

const MOCK = Array.from({ length: 15 }).map((_, i) => ({
  key: `emp-${i + 1}`,
  label: `数字员工 ${i + 1} · 用于 ${['财务', 'HR', '数据', '法务', '客服'][i % 5]} 场景`,
}));

export default function ManualSelectEmployeePage() {
  const [targetKeys, setTargetKeys] = useState<string[]>(['emp-1', 'emp-5']);

  const handleChange: (values: Array<string | number>) => void = (values) => {
    setTargetKeys(values.map(String));
  };

  return (
    <div>
      <Typography.Title heading={4}>手动选择员工</Typography.Title>
      <Card>
        <Space vertical style={{ width: '100%' }}>
          <Transfer
            dataSource={MOCK}
            value={targetKeys}
            onChange={handleChange}
          />
          <div>
            <Typography.Text>已选择：</Typography.Text>
            <Space>
              {targetKeys.length === 0 ? <Tag>无</Tag> :
                targetKeys.map((k) => <Tag key={k} color="blue">{k}</Tag>)}
            </Space>
          </div>
          <Button theme="solid" type="primary" disabled={targetKeys.length === 0}>
            确认选择
          </Button>
        </Space>
      </Card>
    </div>
  );
}
