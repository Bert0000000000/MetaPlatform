import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { ArrowLeft, Save } from 'lucide-react';
import { listEmployees } from '@/api/dw/employees';
import { createCollaboration } from '@/api/dw/collaborations';
import type { SplitStrategy } from '@/api/dw/collaborations';
import type { Employee } from '@/api/dw/types';
import { PageHeader } from '@/components/skeleton';
import './agents.css';

const SPLIT_OPTIONS: { value: SplitStrategy; label: string; hint: string }[] = [
  { value: 'hybrid', label: '混合', hint: '按模板声明的依赖执行（推荐）' },
  { value: 'sequential', label: '顺序执行', hint: '子任务链式依赖' },
  { value: 'parallel', label: '并行执行', hint: '子任务无依赖' },
];

type CollabFormValues = {
  title?: string;
  goal: string;
  description?: string;
  employeeIds: string[];
  splitStrategy: SplitStrategy;
};

/**
 * 创建协作任务（DESIGN-SPEC §5：表单落在 Card 内，页头承载主操作）。
 * 字段名与校验规则沿用旧实现（goal / title / description / employeeIds / splitStrategy）。
 */
export default function CollaborationCreatePage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CollabFormValues>();

  useEffect(() => {
    listEmployees({})
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => setEmployees([]));
  }, []);

  const handleSave = useCallback(async () => {
    let values: CollabFormValues;
    try {
      values = await form.validate();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCollaboration({
        title: values.title,
        goal: values.goal,
        description: values.description,
        employeeIds: values.employeeIds,
        splitStrategy: values.splitStrategy,
      });
      Toast.success('协作任务已创建，系统已根据员工能力自动分工');
      navigate(`/agents/collab/${encodeURIComponent(created.collaborationId)}`);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [form, navigate]);

  return (
    <>
      <PageHeader
        title="创建协作任务"
        desc="描述目标并选择参与员工，系统会按技能匹配度自动把目标拆成带依赖的子任务"
        actions={
          <>
            <Button
              icon={<ArrowLeft size={15} strokeWidth={1.5} />}
              onClick={() => navigate('/agents/collab')}
            >
              返回
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Save size={15} strokeWidth={1.5} />}
              loading={submitting}
              onClick={() => void handleSave()}
            >
              创建并自动分工
            </Button>
          </>
        }
      />

      <Card>
        <Form form={form} initValues={{ splitStrategy: 'hybrid' }}>
          <Form.TextArea
            field="goal"
            label="任务目标"
            rules={[
              { required: true, message: '请输入任务目标' },
              { min: 4, message: '目标至少 4 个字符' },
              { max: 512, message: '目标最多 512 个字符' },
            ]}
            extraText="系统会根据目标关键词自动分解子任务（如分析/报告/邮件等）"
            rows={3}
            placeholder="例：分析 2025 Q3 销售数据并生成报告，发送至客户邮箱"
            showCounter
            maxLength={512}
          />

          <Form.Input
            field="title"
            label="任务标题（可选）"
            rules={[{ max: 256, message: '标题最多 256 个字符' }]}
            placeholder="留空时系统按目标关键词自动生成"
            maxLength={256}
          />

          <Form.TextArea
            field="description"
            label="任务描述（可选）"
            rules={[{ max: 1024, message: '描述最多 1024 个字符' }]}
            rows={2}
            placeholder="任务补充说明"
            maxLength={1024}
          />

          <Form.Select
            field="employeeIds"
            label="参与员工"
            rules={[{ required: true, message: '请至少选择 1 名员工' }]}
            extraText="系统会按员工技能匹配度自动分配子任务"
            multiple
            placeholder="选择参与协作的数字员工"
            optionList={employees.map((e) => ({
              label: `${e.name}（${e.roleIdentity}）`,
              value: e.employeeId,
            }))}
            renderOptionItem={(option) => {
              const emp = employees.find((e) => e.employeeId === option.value);
              return (
                <div>
                  <div>
                    <Typography.Text strong>{option.label}</Typography.Text>
                  </div>
                  {emp?.capability?.tools && emp.capability.tools.length > 0 ? (
                    <span className="mp-agent-chips">
                      {emp.capability.tools.slice(0, 5).map((t) => (
                        <Tag key={t} type="light">
                          {t}
                        </Tag>
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            }}
          />

          <Form.Select
            field="splitStrategy"
            label="拆分策略"
            rules={[{ required: true, message: '请选择拆分策略' }]}
            optionList={SPLIT_OPTIONS.map((o) => ({
              value: o.value,
              label: `${o.label} — ${o.hint}`,
            }))}
          />
        </Form>
      </Card>
    </>
  );
}
