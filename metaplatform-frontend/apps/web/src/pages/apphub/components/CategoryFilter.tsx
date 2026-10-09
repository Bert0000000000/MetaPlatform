import { Radio, Typography, Space } from '@douyinfe/semi-ui';
import type { TemplateItem } from '@/api/apphub/marketplace';

interface CategoryFilterProps {
  value?: TemplateItem['category'];
  onChange: (v?: TemplateItem['category']) => void;
}

const CATEGORIES: Array<{ label: string; value: TemplateItem['category'] }> = [
  { label: '全部', value: '全部' },
  { label: '工作流', value: 'workflow' },
  { label: '表单', value: 'form' },
  { label: '审批', value: 'approval' },
];

export default function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <div>
      <Typography.Text strong>分类：</Typography.Text>
      <Radio.Group
        type="button"
        value={value ?? '全部'}
        onChange={(e) => onChange(e.target.value === '全部' ? undefined : e.target.value)}
        className="mp-ml-3"
      >
        <Space wrap>
          {CATEGORIES.map((c) => (
            <Radio key={c.label} value={c.value}>{c.label}</Radio>
          ))}
        </Space>
      </Radio.Group>
    </div>
  );
}
