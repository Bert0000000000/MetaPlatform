import { Radio, Typography, Space } from 'antd';
import type { TemplateItem } from '@/api/marketplace';

interface CategoryFilterProps {
  value?: TemplateItem['category'];
  onChange: (v?: TemplateItem['category']) => void;
}

const CATEGORIES: Array<{ label: string; value: TemplateItem['category'] }> = [
  { label: '全部', value: 'OA' },
  { label: 'OA', value: 'OA' },
  { label: 'CRM', value: 'CRM' },
  { label: 'HR', value: 'HR' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Project', value: 'Project' },
];

export default function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <div>
      <Typography.Text strong>分类：</Typography.Text>
      <Radio.Group
        value={value ?? '全部'}
        onChange={(e) => onChange(e.target.value === '全部' ? undefined : e.target.value)}
        style={{ marginLeft: 12 }}
      >
        <Space>
          {CATEGORIES.map((c) => (
            <Radio.Button key={c.label} value={c.value}>{c.label}</Radio.Button>
          ))}
        </Space>
      </Radio.Group>
    </div>
  );
}
