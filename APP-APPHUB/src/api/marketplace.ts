export interface TemplateItem {
  templateId: string;
  name: string;
  category: 'OA' | 'CRM' | 'HR' | 'Finance' | 'Project' | 'Other';
  description: string;
  icon: string;
  tags: string[];
  downloadCount: number;
  rating: number;
  preview?: string;
  configSnapshot?: string;
  createdAt: string;
}

const TEMPLATES: TemplateItem[] = [
  {
    templateId: 'tmpl-oa-leave',
    name: '请假申请单',
    category: 'OA',
    description: '员工请假流程，支持多级审批',
    icon: 'FileTextOutlined',
    tags: ['审批', 'OA'],
    downloadCount: 128,
    rating: 4.7,
    configSnapshot: '{}',
    createdAt: '2026-07-01T00:00:00Z',
  },
  {
    templateId: 'tmpl-crm-lead',
    name: '线索跟进表',
    category: 'CRM',
    description: '销售线索全生命周期跟踪',
    icon: 'UserOutlined',
    tags: ['CRM', '销售'],
    downloadCount: 89,
    rating: 4.5,
    configSnapshot: '{}',
    createdAt: '2026-07-02T00:00:00Z',
  },
  {
    templateId: 'tmpl-hr-recruit',
    name: '招聘流程',
    category: 'HR',
    description: '招聘需求、面试、Offer 一体化',
    icon: 'TeamOutlined',
    tags: ['HR', '招聘'],
    downloadCount: 76,
    rating: 4.6,
    configSnapshot: '{}',
    createdAt: '2026-07-03T00:00:00Z',
  },
  {
    templateId: 'tmpl-fin-expense',
    name: '费用报销',
    category: 'Finance',
    description: '差旅/办公费用报销审批',
    icon: 'MoneyOutlined',
    tags: ['财务', '审批'],
    downloadCount: 156,
    rating: 4.8,
    configSnapshot: '{}',
    createdAt: '2026-07-04T00:00:00Z',
  },
  {
    templateId: 'tmpl-proj-task',
    name: '项目任务看板',
    category: 'Project',
    description: '敏捷任务管理，多视图',
    icon: 'ProjectOutlined',
    tags: ['项目管理'],
    downloadCount: 102,
    rating: 4.4,
    configSnapshot: '{}',
    createdAt: '2026-07-05T00:00:00Z',
  },
];

export async function listTemplates(params?: {
  keyword?: string;
  category?: string;
}): Promise<TemplateItem[]> {
  let items = TEMPLATES;
  if (params?.keyword) {
    const k = params.keyword.toLowerCase();
    items = items.filter(
      (t) => t.name.toLowerCase().includes(k) || t.description.toLowerCase().includes(k),
    );
  }
  if (params?.category) {
    items = items.filter((t) => t.category === params.category);
  }
  return items;
}

export async function getTemplate(id: string): Promise<TemplateItem | null> {
  return TEMPLATES.find((t) => t.templateId === id) || null;
}

export async function installTemplate(id: string): Promise<{ success: boolean; appId?: string }> {
  await new Promise((r) => setTimeout(r, 800));
  return { success: true, appId: `app_${id}_${Date.now().toString(36)}` };
}
