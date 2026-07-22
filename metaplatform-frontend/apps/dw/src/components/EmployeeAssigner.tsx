import { Card, Empty, Select, Space, Tag, Typography } from 'antd';
import type { Employee } from '@/types';

interface SubTask {
  title: string;
  assignee: string;
}

interface EmployeeAssignerProps {
  subTasks: SubTask[];
  employees: Employee[];
  onAssign: (subTasks: SubTask[]) => void;
}

export default function EmployeeAssigner({ subTasks, employees, onAssign }: EmployeeAssignerProps) {
  if (subTasks.length === 0) {
    return <Empty description="请先在左侧拆分任务" />;
  }

  return (
    <Card title="员工分配">
      <Space direction="vertical" style={{ width: '100%' }}>
        {subTasks.map((st, i) => (
          <Card key={i} type="inner" size="small" title={st.title}>
            <Space>
              <Typography.Text>分配给：</Typography.Text>
              <Select
                value={st.assignee}
                style={{ width: 200 }}
                onChange={(v) => {
                  const next = [...subTasks];
                  next[i] = { ...st, assignee: v };
                  onAssign(next);
                }}
                options={employees.map((e) => ({
                  label: `${e.name} - ${e.roleIdentity}`,
                  value: e.name,
                }))}
              />
              <Tag color="blue">角色: {employees.find((e) => e.name === st.assignee)?.roleIdentity || '-'}</Tag>
            </Space>
          </Card>
        ))}
      </Space>
    </Card>
  );
}
