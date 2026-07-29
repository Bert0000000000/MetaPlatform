/**
 * V14-04：应用市场模板生态
 * - 内置 20+ 官方模板（覆盖 CRM/HR/财务/采购/项目/协同 6 大类）
 * - localStorage 持久化已安装/已创建模板（mock，后端 API 未实现）
 * - localStorage key: `metaplatform:apphub:templates`
 */

export type TemplateCategory =
  | 'CRM'
  | 'HR'
  | 'Finance'
  | 'Procurement'
  | 'Project'
  | 'Collaboration';

export const TEMPLATE_CATEGORIES: Array<{ label: string; value: TemplateCategory }> = [
  { label: 'CRM', value: 'CRM' },
  { label: 'HR', value: 'HR' },
  { label: '财务', value: 'Finance' },
  { label: '采购', value: 'Procurement' },
  { label: '项目', value: 'Project' },
  { label: '协同', value: 'Collaboration' },
];

export const CATEGORY_COLOR: Record<TemplateCategory, string> = {
  CRM: 'orange',
  HR: 'green',
  Finance: 'gold',
  Procurement: 'cyan',
  Project: 'purple',
  Collaboration: 'blue',
};

export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  CRM: 'CRM',
  HR: 'HR',
  Finance: '财务',
  Procurement: '采购',
  Project: '项目',
  Collaboration: '协同',
};

/** 模板字段定义（精简版，用于详情页字段预览） */
export interface TemplateField {
  fieldKey: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

/** 模板流程节点定义（精简版，用于详情页流程预览） */
export interface TemplateFlowNode {
  id: string;
  name: string;
  type: 'start' | 'approval' | 'condition' | 'end';
  assignee?: string;
}

export interface TemplateFlow {
  name: string;
  description?: string;
  nodes: TemplateFlowNode[];
}

export interface TemplateComment {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

/** 官方模板（只读，作为应用市场初始数据源） */
export interface OfficialTemplate {
  templateId: string;
  name: string;
  category: TemplateCategory;
  description: string;
  icon: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  usageCount: number;
  author: string;
  screenshots: string[];
  fields: TemplateField[];
  flows: TemplateFlow[];
  isOfficial: true;
  createdAt: string;
}

/** 用户模板（已安装或已创建，持久化到 localStorage） */
export interface UserTemplate extends Omit<OfficialTemplate, 'isOfficial'> {
  isOfficial: false;
  source: 'installed' | 'created';
  installedAt: string;
}

const STORAGE_KEY = 'metaplatform:apphub:templates';
const COMMENT_STORAGE_KEY = 'metaplatform:apphub:template-comments';

/** 生成唯一 ID */
function genId(prefix = 'tpl'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 24 个官方模板：覆盖 CRM/HR/财务/采购/项目/协同 6 大类，每类 4 个 */
export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  // ============ CRM（4）============
  {
    templateId: 'official-crm-customer',
    name: '客户管理',
    category: 'CRM',
    description:
      '标准化客户档案管理，包含客户基础信息、联系人、跟进记录、客户分级。支持客户全生命周期追踪与销售漏斗分析。',
    icon: 'TeamOutlined',
    tags: ['客户', '销售', 'CRM'],
    rating: 4.7,
    ratingCount: 128,
    usageCount: 986,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'customerName', label: '客户名称', type: 'text', required: true, placeholder: '请输入客户名称' },
      { fieldKey: 'industry', label: '所属行业', type: 'select', options: ['互联网', '金融', '制造', '零售', '其他'] },
      { fieldKey: 'level', label: '客户等级', type: 'select', required: true, options: ['S 级', 'A 级', 'B 级', 'C 级'] },
      { fieldKey: 'contactName', label: '主联系人', type: 'text' },
      { fieldKey: 'contactPhone', label: '联系电话', type: 'text' },
      { fieldKey: 'address', label: '客户地址', type: 'textarea' },
    ],
    flows: [
      {
        name: '客户建档审批',
        description: '销售提交客户档案 → 销售经理审批 → 总监备案',
        nodes: [
          { id: 'n1', name: '销售提交', type: 'start' },
          { id: 'n2', name: '销售经理审批', type: 'approval', assignee: '销售经理' },
          { id: 'n3', name: '销售总监备案', type: 'approval', assignee: '销售总监' },
          { id: 'n4', name: '建档完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  {
    templateId: 'official-crm-sales',
    name: '销售跟进',
    category: 'CRM',
    description: '记录每次客户跟进情况，支持拜访、电话、邮件多种方式，自动汇总销售漏斗与转化率。',
    icon: 'RiseOutlined',
    tags: ['销售', '跟进', '漏斗'],
    rating: 4.5,
    ratingCount: 86,
    usageCount: 542,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'customer', label: '客户', type: 'select', required: true, options: [] },
      { fieldKey: 'followType', label: '跟进方式', type: 'select', options: ['拜访', '电话', '邮件', '微信'] },
      { fieldKey: 'followTime', label: '跟进时间', type: 'date', required: true },
      { fieldKey: 'content', label: '跟进内容', type: 'textarea', required: true },
      { fieldKey: 'nextPlan', label: '下一步计划', type: 'textarea' },
    ],
    flows: [
      {
        name: '重点客户跟进报备',
        description: 'S 级客户跟进需经理报备',
        nodes: [
          { id: 'n1', name: '销售记录', type: 'start' },
          { id: 'n2', name: '销售经理审阅', type: 'approval', assignee: '销售经理' },
          { id: 'n3', name: '完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-03T00:00:00.000Z',
  },
  {
    templateId: 'official-crm-contract',
    name: '合同管理',
    category: 'CRM',
    description: '销售合同全生命周期管理：起草、审核、签署、归档、回款跟踪，支持合同模板复用。',
    icon: 'FileProtectOutlined',
    tags: ['合同', '签署', '归档'],
    rating: 4.8,
    ratingCount: 152,
    usageCount: 1203,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'contractNo', label: '合同编号', type: 'text', required: true },
      { fieldKey: 'customer', label: '客户', type: 'select', required: true, options: [] },
      { fieldKey: 'amount', label: '合同金额', type: 'number', required: true },
      { fieldKey: 'signDate', label: '签订日期', type: 'date', required: true },
      { fieldKey: 'endDate', label: '到期日期', type: 'date' },
      { fieldKey: 'attachment', label: '合同附件', type: 'file', required: true },
    ],
    flows: [
      {
        name: '合同审批',
        description: '销售起草 → 部门经理 → 法务 → 财务 → 总经理',
        nodes: [
          { id: 'n1', name: '销售起草', type: 'start' },
          { id: 'n2', name: '部门经理审核', type: 'approval', assignee: '部门经理' },
          { id: 'n3', name: '法务审核', type: 'approval', assignee: '法务' },
          { id: 'n4', name: '财务审核', type: 'approval', assignee: '财务' },
          { id: 'n5', name: '总经理审批', type: 'approval', assignee: '总经理' },
          { id: 'n6', name: '签署归档', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-05T00:00:00.000Z',
  },
  {
    templateId: 'official-crm-service',
    name: '客户服务',
    category: 'CRM',
    description: '客户工单与售后问题处理，支持 SLA 时效监控、问题分类、客户满意度回访。',
    icon: 'CustomerServiceOutlined',
    tags: ['售后', '工单', 'SLA'],
    rating: 4.4,
    ratingCount: 64,
    usageCount: 312,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'ticketNo', label: '工单编号', type: 'text', required: true },
      { fieldKey: 'customer', label: '客户', type: 'select', required: true, options: [] },
      { fieldKey: 'issueType', label: '问题类型', type: 'select', options: ['产品咨询', '故障报修', '投诉', '建议'] },
      { fieldKey: 'priority', label: '优先级', type: 'select', options: ['低', '中', '高', '紧急'] },
      { fieldKey: 'description', label: '问题描述', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '工单处理流程',
        nodes: [
          { id: 'n1', name: '客户提交', type: 'start' },
          { id: 'n2', name: '客服分派', type: 'approval', assignee: '客服主管' },
          { id: 'n3', name: '工程师处理', type: 'approval', assignee: '工程师' },
          { id: 'n4', name: '客户确认', type: 'approval', assignee: '客户' },
          { id: 'n5', name: '关闭工单', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-07T00:00:00.000Z',
  },

  // ============ HR（4）============
  {
    templateId: 'official-hr-onboarding',
    name: '员工入职',
    category: 'HR',
    description: '新员工入职全流程：信息登记 → 资料审核 → 合同签订 → 入职培训 → 工位/账号开通。',
    icon: 'UserAddOutlined',
    tags: ['入职', '人事', '新人'],
    rating: 4.6,
    ratingCount: 98,
    usageCount: 678,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'employeeName', label: '姓名', type: 'text', required: true },
      { fieldKey: 'idCard', label: '身份证号', type: 'text', required: true },
      { fieldKey: 'department', label: '入职部门', type: 'select', required: true, options: [] },
      { fieldKey: 'position', label: '岗位', type: 'text', required: true },
      { fieldKey: 'entryDate', label: '入职日期', type: 'date', required: true },
      { fieldKey: 'salary', label: '薪资', type: 'number' },
    ],
    flows: [
      {
        name: '入职审批',
        description: 'HR 录入 → 用人部门确认 → HR 总监审批',
        nodes: [
          { id: 'n1', name: 'HR 录入', type: 'start' },
          { id: 'n2', name: '用人部门确认', type: 'approval', assignee: '部门负责人' },
          { id: 'n3', name: 'HR 总监审批', type: 'approval', assignee: 'HR 总监' },
          { id: 'n4', name: '入职完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-02T00:00:00.000Z',
  },
  {
    templateId: 'official-hr-attendance',
    name: '考勤管理',
    category: 'HR',
    description: '员工考勤打卡、请假、加班、出差统一管理，自动汇总月度考勤报表。',
    icon: 'ClockCircleOutlined',
    tags: ['考勤', '打卡', '请假'],
    rating: 4.3,
    ratingCount: 75,
    usageCount: 489,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'employee', label: '员工', type: 'select', required: true, options: [] },
      { fieldKey: 'leaveType', label: '请假类型', type: 'select', options: ['事假', '病假', '年假', '调休', '婚假'] },
      { fieldKey: 'startDate', label: '开始时间', type: 'date', required: true },
      { fieldKey: 'endDate', label: '结束时间', type: 'date', required: true },
      { fieldKey: 'reason', label: '请假事由', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '请假审批',
        description: '员工发起 → 直属领导审批 → HR 备案',
        nodes: [
          { id: 'n1', name: '员工发起', type: 'start' },
          { id: 'n2', name: '直属领导审批', type: 'approval', assignee: '直属领导' },
          { id: 'n3', name: 'HR 备案', type: 'approval', assignee: 'HR' },
          { id: 'n4', name: '完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-04T00:00:00.000Z',
  },
  {
    templateId: 'official-hr-performance',
    name: '绩效考核',
    category: 'HR',
    description: '员工季度/年度绩效考核，支持 KPI + OKR 双模式，自评 + 上级评 + 360 度反馈。',
    icon: 'TrophyOutlined',
    tags: ['绩效', 'KPI', 'OKR'],
    rating: 4.5,
    ratingCount: 112,
    usageCount: 734,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'employee', label: '被考核人', type: 'select', required: true, options: [] },
      { fieldKey: 'period', label: '考核周期', type: 'select', options: ['Q1', 'Q2', 'Q3', 'Q4', '年度'] },
      { fieldKey: 'kpi', label: 'KPI 完成情况', type: 'textarea', required: true },
      { fieldKey: 'okr', label: 'OKR 完成情况', type: 'textarea' },
      { fieldKey: 'selfScore', label: '自评分数', type: 'number', required: true },
    ],
    flows: [
      {
        name: '绩效审批',
        description: '员工自评 → 直属领导评分 → 隔级领导审核 → HR 归档',
        nodes: [
          { id: 'n1', name: '员工自评', type: 'start' },
          { id: 'n2', name: '直属领导评分', type: 'approval', assignee: '直属领导' },
          { id: 'n3', name: '隔级领导审核', type: 'approval', assignee: '隔级领导' },
          { id: 'n4', name: 'HR 归档', type: 'approval', assignee: 'HR' },
          { id: 'n5', name: '完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-06T00:00:00.000Z',
  },
  {
    templateId: 'official-hr-recruitment',
    name: '招聘管理',
    category: 'HR',
    description: '招聘需求发布、简历筛选、面试安排、Offer 发放、入职衔接全流程管理。',
    icon: 'SolutionOutlined',
    tags: ['招聘', '面试', '简历'],
    rating: 4.4,
    ratingCount: 67,
    usageCount: 421,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'position', label: '招聘岗位', type: 'text', required: true },
      { fieldKey: 'department', label: '需求部门', type: 'select', required: true, options: [] },
      { fieldKey: 'headcount', label: '招聘人数', type: 'number', required: true },
      { fieldKey: 'salaryRange', label: '薪资范围', type: 'text' },
      { fieldKey: 'requirement', label: '岗位要求', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '招聘需求审批',
        nodes: [
          { id: 'n1', name: '部门发起', type: 'start' },
          { id: 'n2', name: 'HR 审核', type: 'approval', assignee: 'HR' },
          { id: 'n3', name: '总裁审批', type: 'approval', assignee: '总裁' },
          { id: 'n4', name: '发布招聘', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-08T00:00:00.000Z',
  },

  // ============ Finance 财务（4）============
  {
    templateId: 'official-fin-expense',
    name: '报销审批',
    category: 'Finance',
    description: '员工费用报销（差旅/招待/办公），支持发票上传、自动校验、多级审批、财务付款。',
    icon: 'AccountBookOutlined',
    tags: ['报销', '差旅', '费用'],
    rating: 4.7,
    ratingCount: 245,
    usageCount: 1842,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'applicant', label: '申请人', type: 'select', required: true, options: [] },
      { fieldKey: 'expenseType', label: '费用类型', type: 'select', required: true, options: ['差旅', '招待', '办公', '培训', '其他'] },
      { fieldKey: 'amount', label: '报销金额', type: 'number', required: true },
      { fieldKey: 'occurDate', label: '发生日期', type: 'date', required: true },
      { fieldKey: 'invoice', label: '发票', type: 'file', required: true },
      { fieldKey: 'description', label: '费用说明', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '报销审批',
        description: '员工提交 → 直属领导 → 部门经理 → 财务 → 出纳付款',
        nodes: [
          { id: 'n1', name: '员工提交', type: 'start' },
          { id: 'n2', name: '直属领导审批', type: 'approval', assignee: '直属领导' },
          { id: 'n3', name: '部门经理审批', type: 'approval', assignee: '部门经理' },
          { id: 'n4', name: '财务审核', type: 'approval', assignee: '财务' },
          { id: 'n5', name: '出纳付款', type: 'approval', assignee: '出纳' },
          { id: 'n6', name: '完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  {
    templateId: 'official-fin-payment',
    name: '付款申请',
    category: 'Finance',
    description: '对外付款申请管理：合同付款、供应商付款、预付款，关联合同与发票。',
    icon: 'DollarOutlined',
    tags: ['付款', '合同', '供应商'],
    rating: 4.6,
    ratingCount: 134,
    usageCount: 968,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'payee', label: '收款方', type: 'text', required: true },
      { fieldKey: 'bankAccount', label: '收款账号', type: 'text', required: true },
      { fieldKey: 'amount', label: '付款金额', type: 'number', required: true },
      { fieldKey: 'contractNo', label: '关联合同', type: 'text' },
      { fieldKey: 'payDate', label: '计划付款日', type: 'date', required: true },
      { fieldKey: 'reason', label: '付款事由', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '付款审批',
        nodes: [
          { id: 'n1', name: '申请人提交', type: 'start' },
          { id: 'n2', name: '部门经理', type: 'approval', assignee: '部门经理' },
          { id: 'n3', name: '财务经理', type: 'approval', assignee: '财务经理' },
          { id: 'n4', name: '财务总监', type: 'approval', assignee: '财务总监' },
          { id: 'n5', name: '付款完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-03T00:00:00.000Z',
  },
  {
    templateId: 'official-fin-budget',
    name: '预算管理',
    category: 'Finance',
    description: '年度预算编制、审批、执行、调整、分析全过程管理，支持部门维度预算控制。',
    icon: 'FundProjectionScreenOutlined',
    tags: ['预算', '年度', '控制'],
    rating: 4.5,
    ratingCount: 89,
    usageCount: 532,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'department', label: '预算部门', type: 'select', required: true, options: [] },
      { fieldKey: 'fiscalYear', label: '预算年度', type: 'select', required: true, options: ['2025', '2026', '2027'] },
      { fieldKey: 'category', label: '预算科目', type: 'select', options: ['人力', '市场', '研发', '行政', '其他'] },
      { fieldKey: 'amount', label: '预算金额', type: 'number', required: true },
      { fieldKey: 'description', label: '预算说明', type: 'textarea' },
    ],
    flows: [
      {
        name: '预算审批',
        nodes: [
          { id: 'n1', name: '部门编制', type: 'start' },
          { id: 'n2', name: '财务汇总', type: 'approval', assignee: '财务' },
          { id: 'n3', name: '预算委员会', type: 'approval', assignee: '预算委员会' },
          { id: 'n4', name: '总裁审批', type: 'approval', assignee: '总裁' },
          { id: 'n5', name: '下达执行', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-05T00:00:00.000Z',
  },
  {
    templateId: 'official-fin-invoice',
    name: '发票管理',
    category: 'Finance',
    description: '进项/销项发票统一管理，支持发票查验、归档、统计分析、税务申报。',
    icon: 'AuditOutlined',
    tags: ['发票', '税务', '归档'],
    rating: 4.4,
    ratingCount: 56,
    usageCount: 312,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'invoiceNo', label: '发票号码', type: 'text', required: true },
      { fieldKey: 'invoiceType', label: '发票类型', type: 'select', options: ['增值税专用', '增值税普通', '电子发票', '其他'] },
      { fieldKey: 'amount', label: '发票金额', type: 'number', required: true },
      { fieldKey: 'taxAmount', label: '税额', type: 'number' },
      { fieldKey: 'invoiceDate', label: '开票日期', type: 'date', required: true },
      { fieldKey: 'attachment', label: '发票影像', type: 'file', required: true },
    ],
    flows: [
      {
        name: '发票审核',
        nodes: [
          { id: 'n1', name: '提交', type: 'start' },
          { id: 'n2', name: '财务审核', type: 'approval', assignee: '财务' },
          { id: 'n3', name: '归档', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-07T00:00:00.000Z',
  },

  // ============ Procurement 采购（4）============
  {
    templateId: 'official-proc-request',
    name: '采购申请',
    category: 'Procurement',
    description: '采购需求申请与审批，关联预算与供应商，自动生成采购订单。',
    icon: 'ShoppingCartOutlined',
    tags: ['采购', '申请', '需求'],
    rating: 4.5,
    ratingCount: 102,
    usageCount: 687,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'department', label: '申请部门', type: 'select', required: true, options: [] },
      { fieldKey: 'item', label: '采购物品', type: 'text', required: true },
      { fieldKey: 'quantity', label: '数量', type: 'number', required: true },
      { fieldKey: 'estimatedAmount', label: '预估金额', type: 'number', required: true },
      { fieldKey: 'reason', label: '采购事由', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '采购审批',
        description: '部门申请 → 采购审核 → 财务审核 → 总监审批',
        nodes: [
          { id: 'n1', name: '部门申请', type: 'start' },
          { id: 'n2', name: '采购审核', type: 'approval', assignee: '采购经理' },
          { id: 'n3', name: '财务审核', type: 'approval', assignee: '财务' },
          { id: 'n4', name: '总监审批', type: 'approval', assignee: '总监' },
          { id: 'n5', name: '采购执行', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-02T00:00:00.000Z',
  },
  {
    templateId: 'official-proc-supplier',
    name: '供应商管理',
    category: 'Procurement',
    description: '供应商档案、资质、评价、分级管理，支持供应商准入与淘汰流程。',
    icon: 'ShopOutlined',
    tags: ['供应商', '资质', '评价'],
    rating: 4.4,
    ratingCount: 71,
    usageCount: 423,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'supplierName', label: '供应商名称', type: 'text', required: true },
      { fieldKey: 'contact', label: '联系人', type: 'text', required: true },
      { fieldKey: 'phone', label: '联系电话', type: 'text', required: true },
      { fieldKey: 'category', label: '供应品类', type: 'select', options: ['原材料', '设备', '服务', '办公用品', '其他'] },
      { fieldKey: 'qualification', label: '资质文件', type: 'file' },
    ],
    flows: [
      {
        name: '供应商准入',
        nodes: [
          { id: 'n1', name: '采购录入', type: 'start' },
          { id: 'n2', name: '资质审核', type: 'approval', assignee: '采购经理' },
          { id: 'n3', name: '总经理审批', type: 'approval', assignee: '总经理' },
          { id: 'n4', name: '准入完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-04T00:00:00.000Z',
  },
  {
    templateId: 'official-proc-order',
    name: '采购订单',
    category: 'Procurement',
    description: '采购订单创建、确认、发货跟踪、到货验收、付款对账全流程。',
    icon: 'FileTextOutlined',
    tags: ['订单', '采购', '验收'],
    rating: 4.5,
    ratingCount: 88,
    usageCount: 567,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'orderNo', label: '订单编号', type: 'text', required: true },
      { fieldKey: 'supplier', label: '供应商', type: 'select', required: true, options: [] },
      { fieldKey: 'totalAmount', label: '订单总额', type: 'number', required: true },
      { fieldKey: 'deliveryDate', label: '交货日期', type: 'date', required: true },
      { fieldKey: 'items', label: '采购明细', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '订单流程',
        nodes: [
          { id: 'n1', name: '创建订单', type: 'start' },
          { id: 'n2', name: '供应商确认', type: 'approval', assignee: '供应商' },
          { id: 'n3', name: '到货验收', type: 'approval', assignee: '验收员' },
          { id: 'n4', name: '入库', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-06T00:00:00.000Z',
  },
  {
    templateId: 'official-proc-warehouse',
    name: '入库管理',
    category: 'Procurement',
    description: '采购入库、生产入库、退货入库统一管理，自动更新库存台账。',
    icon: 'InboxOutlined',
    tags: ['入库', '库存', '仓库'],
    rating: 4.3,
    ratingCount: 49,
    usageCount: 287,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'warehouseNo', label: '入库单号', type: 'text', required: true },
      { fieldKey: 'inboundType', label: '入库类型', type: 'select', options: ['采购入库', '生产入库', '退货入库', '其他'] },
      { fieldKey: 'warehouse', label: '仓库', type: 'select', options: [] },
      { fieldKey: 'inboundDate', label: '入库日期', type: 'date', required: true },
      { fieldKey: 'items', label: '入库明细', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '入库流程',
        nodes: [
          { id: 'n1', name: '提交', type: 'start' },
          { id: 'n2', name: '仓管员验收', type: 'approval', assignee: '仓管员' },
          { id: 'n3', name: '入库完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-08T00:00:00.000Z',
  },

  // ============ Project 项目（4）============
  {
    templateId: 'official-proj-init',
    name: '项目立项',
    category: 'Project',
    description: '项目立项申请：项目背景、目标、范围、预算、资源、风险评估，多级审批。',
    icon: 'RocketOutlined',
    tags: ['立项', '启动', '项目'],
    rating: 4.6,
    ratingCount: 93,
    usageCount: 612,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'projectName', label: '项目名称', type: 'text', required: true },
      { fieldKey: 'projectType', label: '项目类型', type: 'select', options: ['产品', '研发', '市场', '内部', '其他'] },
      { fieldKey: 'sponsor', label: '项目发起人', type: 'select', required: true, options: [] },
      { fieldKey: 'budget', label: '项目预算', type: 'number', required: true },
      { fieldKey: 'startDate', label: '计划开始', type: 'date', required: true },
      { fieldKey: 'endDate', label: '计划结束', type: 'date', required: true },
      { fieldKey: 'background', label: '项目背景', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '立项审批',
        nodes: [
          { id: 'n1', name: '发起立项', type: 'start' },
          { id: 'n2', name: '部门审批', type: 'approval', assignee: '部门经理' },
          { id: 'n3', name: 'PMO 审核', type: 'approval', assignee: 'PMO' },
          { id: 'n4', name: '总裁审批', type: 'approval', assignee: '总裁' },
          { id: 'n5', name: '立项完成', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  {
    templateId: 'official-proj-task',
    name: '任务管理',
    category: 'Project',
    description: '项目任务分解、分配、跟踪、关闭，支持看板与甘特图两种视图。',
    icon: 'CheckSquareOutlined',
    tags: ['任务', '看板', '甘特'],
    rating: 4.7,
    ratingCount: 156,
    usageCount: 1245,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'taskName', label: '任务名称', type: 'text', required: true },
      { fieldKey: 'project', label: '所属项目', type: 'select', required: true, options: [] },
      { fieldKey: 'assignee', label: '负责人', type: 'select', required: true, options: [] },
      { fieldKey: 'priority', label: '优先级', type: 'select', options: ['P0', 'P1', 'P2', 'P3'] },
      { fieldKey: 'dueDate', label: '截止日期', type: 'date', required: true },
      { fieldKey: 'description', label: '任务描述', type: 'textarea' },
    ],
    flows: [
      {
        name: '任务验收',
        nodes: [
          { id: 'n1', name: '负责人完成', type: 'start' },
          { id: 'n2', name: '项目经理验收', type: 'approval', assignee: '项目经理' },
          { id: 'n3', name: '关闭任务', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-03T00:00:00.000Z',
  },
  {
    templateId: 'official-proj-weekly',
    name: '项目周报',
    category: 'Project',
    description: '项目周报模板：本周进展、下周计划、风险问题、资源需求，标准化汇报。',
    icon: 'ScheduleOutlined',
    tags: ['周报', '汇报', '进展'],
    rating: 4.4,
    ratingCount: 67,
    usageCount: 432,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'project', label: '项目', type: 'select', required: true, options: [] },
      { fieldKey: 'week', label: '周次', type: 'text', required: true },
      { fieldKey: 'progress', label: '本周进展', type: 'textarea', required: true },
      { fieldKey: 'plan', label: '下周计划', type: 'textarea', required: true },
      { fieldKey: 'risks', label: '风险与问题', type: 'textarea' },
      { fieldKey: 'resource', label: '资源需求', type: 'textarea' },
    ],
    flows: [
      {
        name: '周报审批',
        nodes: [
          { id: 'n1', name: '项目经理提交', type: 'start' },
          { id: 'n2', name: 'PMO 审阅', type: 'approval', assignee: 'PMO' },
          { id: 'n3', name: '归档', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-05T00:00:00.000Z',
  },
  {
    templateId: 'official-proj-risk',
    name: '风险管理',
    category: 'Project',
    description: '项目风险识别、评估、应对、跟踪、关闭，标准化风险管理流程。',
    icon: 'WarningOutlined',
    tags: ['风险', '识别', '应对'],
    rating: 4.3,
    ratingCount: 41,
    usageCount: 198,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'riskName', label: '风险名称', type: 'text', required: true },
      { fieldKey: 'project', label: '所属项目', type: 'select', required: true, options: [] },
      { fieldKey: 'category', label: '风险类别', type: 'select', options: ['进度', '成本', '质量', '资源', '外部'] },
      { fieldKey: 'probability', label: '发生概率', type: 'select', options: ['低', '中', '高'] },
      { fieldKey: 'impact', label: '影响程度', type: 'select', options: ['低', '中', '高'] },
      { fieldKey: 'response', label: '应对措施', type: 'textarea', required: true },
    ],
    flows: [
      {
        name: '风险评审',
        nodes: [
          { id: 'n1', name: '识别录入', type: 'start' },
          { id: 'n2', name: 'PMO 评审', type: 'approval', assignee: 'PMO' },
          { id: 'n3', name: '应对跟踪', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-07T00:00:00.000Z',
  },

  // ============ Collaboration 协同（4）============
  {
    templateId: 'official-collab-meeting',
    name: '会议预约',
    category: 'Collaboration',
    description: '会议室预约、议程管理、参会人通知、纪要生成、决议跟踪。',
    icon: 'VideoCameraOutlined',
    tags: ['会议', '预约', '纪要'],
    rating: 4.5,
    ratingCount: 124,
    usageCount: 892,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'topic', label: '会议主题', type: 'text', required: true },
      { fieldKey: 'organizer', label: '组织者', type: 'select', required: true, options: [] },
      { fieldKey: 'meetingDate', label: '会议日期', type: 'date', required: true },
      { fieldKey: 'duration', label: '时长（分钟）', type: 'number', required: true },
      { fieldKey: 'room', label: '会议室', type: 'select', options: [] },
      { fieldKey: 'attendees', label: '参会人', type: 'textarea', required: true },
      { fieldKey: 'agenda', label: '会议议程', type: 'textarea' },
    ],
    flows: [
      {
        name: '会议预约',
        nodes: [
          { id: 'n1', name: '发起预约', type: 'start' },
          { id: 'n2', name: '会议室确认', type: 'approval', assignee: '行政' },
          { id: 'n3', name: '通知参会', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-02T00:00:00.000Z',
  },
  {
    templateId: 'official-collab-document',
    name: '公文流转',
    category: 'Collaboration',
    description: '企业公文拟稿、核稿、会签、签发、传阅、归档全流程。',
    icon: 'FileDoneOutlined',
    tags: ['公文', '流转', '签发'],
    rating: 4.4,
    ratingCount: 58,
    usageCount: 348,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'docNo', label: '公文编号', type: 'text', required: true },
      { fieldKey: 'title', label: '公文标题', type: 'text', required: true },
      { fieldKey: 'docType', label: '公文类型', type: 'select', options: ['通知', '决定', '请示', '报告', '批复', '其他'] },
      { fieldKey: 'urgency', label: '紧急程度', type: 'select', options: ['普通', '紧急', '特急'] },
      { fieldKey: 'content', label: '正文', type: 'file', required: true },
    ],
    flows: [
      {
        name: '公文流转',
        nodes: [
          { id: 'n1', name: '拟稿', type: 'start' },
          { id: 'n2', name: '核稿', type: 'approval', assignee: '部门负责人' },
          { id: 'n3', name: '会签', type: 'approval', assignee: '会签部门' },
          { id: 'n4', name: '签发', type: 'approval', assignee: '签发领导' },
          { id: 'n5', name: '归档', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-04T00:00:00.000Z',
  },
  {
    templateId: 'official-collab-supplies',
    name: '办公用品',
    category: 'Collaboration',
    description: '办公用品领用申请、库存管理、采购补货，简化行政工作。',
    icon: 'GiftOutlined',
    tags: ['办公', '领用', '行政'],
    rating: 4.2,
    ratingCount: 36,
    usageCount: 215,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'applicant', label: '申请人', type: 'select', required: true, options: [] },
      { fieldKey: 'item', label: '用品名称', type: 'text', required: true },
      { fieldKey: 'quantity', label: '数量', type: 'number', required: true },
      { fieldKey: 'purpose', label: '用途', type: 'textarea' },
    ],
    flows: [
      {
        name: '领用审批',
        nodes: [
          { id: 'n1', name: '员工申请', type: 'start' },
          { id: 'n2', name: '行政审批', type: 'approval', assignee: '行政' },
          { id: 'n3', name: '发放', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-06T00:00:00.000Z',
  },
  {
    templateId: 'official-collab-knowledge',
    name: '知识库',
    category: 'Collaboration',
    description: '企业知识库管理：文档分类、版本、权限、检索，支持团队协作编辑。',
    icon: 'BookOutlined',
    tags: ['知识', '文档', '检索'],
    rating: 4.6,
    ratingCount: 87,
    usageCount: 654,
    author: 'Mate 官方',
    screenshots: [],
    fields: [
      { fieldKey: 'title', label: '文档标题', type: 'text', required: true },
      { fieldKey: 'category', label: '分类', type: 'select', options: ['产品', '技术', '运营', '市场', '人事', '其他'] },
      { fieldKey: 'tags', label: '标签', type: 'text' },
      { fieldKey: 'visibility', label: '可见范围', type: 'select', options: ['公开', '部门', '私密'] },
      { fieldKey: 'content', label: '内容', type: 'file', required: true },
    ],
    flows: [
      {
        name: '文档发布',
        nodes: [
          { id: 'n1', name: '作者提交', type: 'start' },
          { id: 'n2', name: '主编审核', type: 'approval', assignee: '主编' },
          { id: 'n3', name: '发布', type: 'end' },
        ],
      },
    ],
    isOfficial: true,
    createdAt: '2026-06-08T00:00:00.000Z',
  },
];

// ====================== localStorage 工具 ======================

/** 读取已安装/已创建模板列表 */
export function loadUserTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 保存已安装/已创建模板列表 */
function saveUserTemplates(list: UserTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** 安装官方模板到"我的模板" */
export function installOfficialTemplate(templateId: string): UserTemplate | null {
  const official = OFFICIAL_TEMPLATES.find((t) => t.templateId === templateId);
  if (!official) return null;
  const existing = loadUserTemplates();
  if (existing.some((t) => t.templateId === templateId)) {
    return null; // 已安装
  }
  const { isOfficial: _isOfficial, ...rest } = official;
  void _isOfficial;
  const userTpl: UserTemplate = {
    ...rest,
    isOfficial: false,
    source: 'installed',
    installedAt: new Date().toISOString(),
  };
  saveUserTemplates([userTpl, ...existing]);
  return userTpl;
}

/** 添加用户创建的模板 */
export function addCreatedTemplate(
  input: Omit<UserTemplate, 'templateId' | 'isOfficial' | 'source' | 'installedAt' | 'usageCount' | 'ratingCount' | 'rating'> &
    Partial<Pick<UserTemplate, 'rating' | 'ratingCount' | 'usageCount'>>,
): UserTemplate {
  const existing = loadUserTemplates();
  const userTpl: UserTemplate = {
    templateId: genId('user'),
    isOfficial: false,
    source: 'created',
    installedAt: new Date().toISOString(),
    rating: input.rating ?? 0,
    ratingCount: input.ratingCount ?? 0,
    usageCount: input.usageCount ?? 0,
    name: input.name,
    category: input.category,
    description: input.description,
    icon: input.icon,
    tags: input.tags,
    author: input.author,
    screenshots: input.screenshots,
    fields: input.fields,
    flows: input.flows,
    createdAt: input.createdAt,
  };
  saveUserTemplates([userTpl, ...existing]);
  return userTpl;
}

/** 删除用户模板 */
export function removeUserTemplate(templateId: string): void {
  const list = loadUserTemplates().filter((t) => t.templateId !== templateId);
  saveUserTemplates(list);
}

// ====================== 评论相关 ======================

/** 读取某模板的评论 */
export function loadTemplateComments(templateId: string): TemplateComment[] {
  try {
    const raw = localStorage.getItem(COMMENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TemplateComment[];
    return (Array.isArray(parsed) ? parsed : []).filter((c) => c.templateId === templateId);
  } catch {
    return [];
  }
}

/** 添加评论（同时更新对应官方模板的 ratingCount/rating 缓存） */
export function addTemplateComment(
  templateId: string,
  userId: string,
  rating: number,
  comment?: string,
): TemplateComment {
  try {
    const raw = localStorage.getItem(COMMENT_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as TemplateComment[]) : [];
    const item: TemplateComment = {
      id: genId('cmt'),
      templateId,
      userId,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };
    all.push(item);
    localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(all));
    return item;
  } catch {
    return {
      id: genId('cmt'),
      templateId,
      userId,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };
  }
}

/** 计算模板平均评分（基于评论 + 官方基线） */
export function computeTemplateRating(templateId: string, baseline: { rating: number; ratingCount: number }): {
  rating: number;
  ratingCount: number;
} {
  const comments = loadTemplateComments(templateId);
  if (comments.length === 0) return baseline;
  const totalCount = baseline.ratingCount + comments.length;
  const totalScore = baseline.rating * baseline.ratingCount + comments.reduce((s, c) => s + c.rating, 0);
  return {
    rating: Number((totalScore / totalCount).toFixed(2)),
    ratingCount: totalCount,
  };
}
