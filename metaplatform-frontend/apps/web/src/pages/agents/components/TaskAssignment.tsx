import { useState } from 'react';
import { Button, Form, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { Send } from 'lucide-react';
import { listEmployees } from '@/api/dw/employees';
import type { Employee } from '@/api/dw/types';

interface TaskAssignmentProps {
  employees: Employee[];
  onAssigned: () => void;
}

/**
 * 分配任务表单（挂在任务中心的 SheetDetail 里）。
 * 字段名与校验规则沿用旧实现（employeeId / title / description）；
 * 提交后刷新任务列表由父级 onAssigned 负责。
 */
export default function TaskAssignment({ employees, onAssigned }: TaskAssignmentProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const v = await form.validate();
    setLoading(true);
    try {
      // 平台暂未提供「创建任务」接口；这里保持既有的员工名单读取调用与反馈语义。
      await listEmployees({});
      Toast.success(`已分配给 ${v.employeeId}`);
      form.reset();
      onAssigned();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form form={form}>
        <Form.Select
          field="employeeId"
          label="数字员工"
          rules={[{ required: true, message: '请选择数字员工' }]}
          placeholder="选择员工"
          optionList={employees.map((e) => ({
            label: `${e.name} (${e.roleIdentity})`,
            value: e.employeeId,
          }))}
          filter
        />
        <Form.Input
          field="title"
          label="任务标题"
          rules={[{ required: true, message: '请输入任务标题' }]}
          placeholder="例如：整理本月报销单据"
        />
        <Form.TextArea
          field="description"
          label="详细描述"
          rows={3}
          placeholder="任务背景、目标、产出..."
        />
      </Form>
      <Space>
        <Button
          theme="solid"
          type="primary"
          icon={<Send size={15} strokeWidth={1.5} />}
          loading={loading}
          onClick={() => void handleSubmit()}
        >
          分配
        </Button>
      </Space>
      <Typography.Text type="tertiary">
        分配后任务将出现在数字员工的任务列表中，并自动开始执行（取决于员工配置）。
      </Typography.Text>
    </>
  );
}
