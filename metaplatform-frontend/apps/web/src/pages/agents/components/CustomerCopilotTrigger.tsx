import React, { useState } from 'react';
import { Button } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { CustomerCopilotDrawer } from './CustomerCopilotDrawer';

/**
 * 客户详情页 Object Copilot 触发器（P4.2.2）。
 *
 * <p>作为页内按钮嵌入，触发后弹出右侧 Drawer。</p>
 */
export function CustomerCopilotTrigger({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="primary" icon={<RobotOutlined />} onClick={() => setOpen(true)}>
        AI 分析
      </Button>
      <CustomerCopilotDrawer
        open={open}
        onClose={() => setOpen(false)}
        customerId={customerId}
        customerName={customerName}
      />
    </>
  );
}
