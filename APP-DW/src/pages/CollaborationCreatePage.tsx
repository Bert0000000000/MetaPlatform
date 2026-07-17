import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Space,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { listEmployees } from '@/api/employees';
import { createCollaboration } from '@/api/collaborations';
import TaskSplitter from '@/components/TaskSplitter';
import EmployeeAssigner from '@/components/EmployeeAssigner';
import type { Employee } from '@/types';

export default function CollaborationCreatePage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [subTasks, setSubTasks] = useState<Array<{ title: string; assignee: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listEmployees({}).then((r) => setEmployees(r.items));
  }, []);

  const handleSave = async () => {
    if (subTasks.length === 0) {
      message.warning('请先拆分子任务');
      return;
    }
    setSubmitting(true);
    try {
      await createCollaboration({
        title: '协作任务',
        splitStrategy: 'parallel',
        subtasks: subTasks.map((s, i) => ({
          id: `sub_${i}`,
          employeeId: employees.find((e) => e.name === s.assignee)?.employeeId || '',
          title: s.title,
          status: 'pending',
          progress: 0,
        })),
        createdBy: 'admin',
      });
      message.success('协作任务已创建');
      navigate('/dw/collaborations');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw/collaborations')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          创建协作任务
        </Typography.Title>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          onClick={handleSave}
          disabled={subTasks.length === 0}
        >
          保存
        </Button>
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TaskSplitter onSubTasksGenerated={setSubTasks} />
        {subTasks.length === 0 ? (
          <Card>
            <Empty description="AI 拆分后才能分配员工" />
          </Card>
        ) : (
          <EmployeeAssigner
            subTasks={subTasks}
            employees={employees}
            onAssign={setSubTasks}
          />
        )}
      </div>
    </div>
  );
}
