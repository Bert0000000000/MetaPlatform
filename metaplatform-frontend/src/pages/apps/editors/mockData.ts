// Default page templates -- used as initial data when creating new pages. Replace with API-fetched data in production.
/**
 * Mock 数据模块 —— 为各页面类型提供预设数据
 *
 * 设计原则：
 * 1. 当 filesystem 中没有 page-{id}.json 时，按 pageType 自动填充
 * 2. 数据结构与各编辑器的 DEFAULT_* 常量完全对齐
 * 3. 保存后会覆盖为真实数据，mock 仅作为初始展示
 */

import type { PageComponent } from "./types";

/* ══════════════════════════════════════════════════════════════
 *  列表页面 Mock 数据
 * ══════════════════════════════════════════════════════════════ */

/** 客户列表 — 默认列 + 10 行模拟数据 */
export function mockListPage(pageName: string): PageComponent[] {
  const isCustomer = pageName.includes("客户");
  const isContract = pageName.includes("合同");

  const columns = isContract
    ? [
        { name: "序号", field: "index", width: "60px", sortable: false },
        { name: "合同编号", field: "code", width: "120px", sortable: true },
        { name: "合同名称", field: "name", width: "auto", sortable: true },
        { name: "甲方", field: "party_a", width: "120px", sortable: true },
        { name: "合同金额", field: "amount", width: "110px", sortable: true },
        { name: "状态", field: "status", width: "80px", sortable: false },
        { name: "创建人", field: "creator", width: "100px", sortable: true },
        { name: "操作", field: "actions", width: "80px", sortable: false },
      ]
    : [
        { name: "序号", field: "index", width: "60px", sortable: false },
        { name: "客户名称", field: "name", width: "auto", sortable: true },
        { name: "联系电话", field: "phone", width: "120px", sortable: false },
        { name: "所属公司", field: "company", width: "140px", sortable: true },
        { name: "客户等级", field: "level", width: "90px", sortable: true },
        { name: "创建人", field: "creator", width: "100px", sortable: true },
        { name: "更新时间", field: "updated_at", width: "140px", sortable: true },
        { name: "操作", field: "actions", width: "80px", sortable: false },
      ];

  const rows = isContract
    ? [
        { code: "HT-2026-001", name: "CRM 系统采购合同", party_a: "上海科技有限公司", amount: "¥ 128,000", status: "生效中", creator: "张三", updated_at: "2026-06-15" },
        { code: "HT-2026-002", name: "年度运维服务合同", party_a: "北京软件科技", amount: "¥ 56,000", status: "生效中", creator: "李四", updated_at: "2026-06-10" },
        { code: "HT-2026-003", name: "数据平台建设合同", party_a: "深圳数据科技", amount: "¥ 320,000", status: "待审批", creator: "王五", updated_at: "2026-05-28" },
        { code: "HT-2026-004", name: "硬件设备采购合同", party_a: "广州科技集团", amount: "¥ 89,500", status: "已到期", creator: "赵六", updated_at: "2026-05-20" },
        { code: "HT-2026-005", name: "API 接口授权合同", party_a: "杭州云科技", amount: "¥ 45,000", status: "生效中", creator: "张三", updated_at: "2026-05-15" },
        { code: "HT-2026-006", name: "咨询服务框架协议", party_a: "成都咨询有限公司", amount: "¥ 72,000", status: "草稿", creator: "李四", updated_at: "2026-05-10" },
        { code: "HT-2026-007", name: "安全审计服务合同", party_a: "武汉网络安全", amount: "¥ 35,000", status: "生效中", creator: "王五", updated_at: "2026-04-28" },
        { code: "HT-2026-008", name: "移动端开发合同", party_a: "南京移动科技", amount: "¥ 168,000", status: "待审批", creator: "赵六", updated_at: "2026-04-20" },
        { code: "HT-2026-009", name: "AI 模型训练合同", party_a: "上海人工智能", amount: "¥ 256,000", status: "生效中", creator: "张三", updated_at: "2026-04-15" },
        { code: "HT-2026-010", name: "云计算资源租赁合同", party_a: "北京云服务", amount: "¥ 192,000", status: "生效中", creator: "李四", updated_at: "2026-04-10" },
      ]
    : [
        { name: "张伟", phone: "138-0001-0001", company: "上海科技有限公司", level: "A", creator: "张三", updated_at: "2026-06-15" },
        { name: "李娜", phone: "139-0002-0002", company: "北京软件科技", level: "B", creator: "李四", updated_at: "2026-06-10" },
        { name: "王强", phone: "136-0003-0003", company: "深圳数据科技", level: "A", creator: "王五", updated_at: "2026-05-28" },
        { name: "刘洋", phone: "137-0004-0004", company: "广州科技集团", level: "C", creator: "赵六", updated_at: "2026-05-20" },
        { name: "陈静", phone: "135-0005-0005", company: "杭州云科技", level: "B", creator: "张三", updated_at: "2026-05-15" },
        { name: "赵磊", phone: "158-0006-0006", company: "成都咨询有限公司", level: "A", creator: "李四", updated_at: "2026-05-10" },
        { name: "孙丽", phone: "159-0007-0007", company: "武汉网络安全", level: "B", creator: "王五", updated_at: "2026-04-28" },
        { name: "周杰", phone: "186-0008-0008", company: "南京移动科技", level: "C", creator: "赵六", updated_at: "2026-04-20" },
        { name: "吴敏", phone: "188-0009-0009", company: "上海人工智能", level: "A", creator: "张三", updated_at: "2026-04-15" },
        { name: "郑浩", phone: "177-0010-0010", company: "北京云服务", level: "B", creator: "李四", updated_at: "2026-04-10" },
      ];

  return [{
    id: "list-config",
    type: "list-config",
    label: "列表配置",
    props: {
      columns,
      rows,
      config: {
        supportSearch: true,
        includeChildren: false,
        selectLevel: "all",
        defaultExpand: "all",
        expandLevel: 1,
      },
    },
  }];
}

/* ══════════════════════════════════════════════════════════════
 *  表单 / LowCode 页面 Mock 数据
 * ══════════════════════════════════════════════════════════════ */

export function mockFormPage(pageName: string): PageComponent[] {
  return [
    { id: "comp-h1", type: "heading", label: "标题", props: { text: pageName || "客户信息登记表" }, span: 12 },
    { id: "comp-text1", type: "text", label: "文本", props: { text: "请填写以下信息完成登记" }, span: 12 },
    { id: "comp-in1", type: "input", label: "输入框", props: { placeholder: "请输入客户姓名", required: true }, span: 6 },
    { id: "comp-in2", type: "input", label: "输入框", props: { placeholder: "请输入联系电话", required: true }, span: 6 },
    { id: "comp-in3", type: "input", label: "输入框", props: { placeholder: "请输入邮箱地址" }, span: 6 },
    { id: "comp-in4", type: "input", label: "输入框", props: { placeholder: "请输入公司名称", required: true }, span: 6 },
    { id: "comp-in5", type: "input", label: "输入框", props: { placeholder: "请输入职位" }, span: 6 },
    { id: "comp-in6", type: "input", label: "输入框", props: { placeholder: "请输入所在城市" }, span: 6 },
    { id: "comp-div1", type: "divider", label: "分割线", props: {}, span: 12 },
    { id: "comp-h2", type: "heading", label: "标题", props: { text: "备注信息" }, span: 12 },
    { id: "comp-in7", type: "input", label: "输入框", props: { placeholder: "请填写备注或补充信息" }, span: 12 },
    { id: "comp-card1", type: "card", label: "卡片", props: { text: "附件上传区域" }, span: 12 },
    { id: "comp-div2", type: "divider", label: "分割线", props: {}, span: 12 },
    { id: "comp-btn1", type: "button", label: "按钮", props: { text: "提交" }, span: 6 },
    { id: "comp-btn2", type: "button", label: "按钮", props: { text: "重置" }, span: 6 },
  ];
}

/* ══════════════════════════════════════════════════════════════
 *  报表 / 仪表盘 Mock 数据
 * ══════════════════════════════════════════════════════════════ */

export function mockReportPage(pageName: string): PageComponent[] {
  const isOpportunity = pageName.includes("商机");

  const widgets = isOpportunity
    ? [
        { id: "w-kpi-1", type: "kpi", title: "总商机数", span: 3 },
        { id: "w-kpi-2", type: "kpi", title: "本月新增", span: 3 },
        { id: "w-kpi-3", type: "kpi", title: "赢单率", span: 3 },
        { id: "w-kpi-4", type: "kpi", title: "平均成交周期", span: 3 },
        { id: "w-bar-1", type: "bar", title: "商机阶段分布", span: 6 },
        { id: "w-line-1", type: "line", title: "商机增长趋势", span: 6 },
        { id: "w-pie-1", type: "pie", title: "来源渠道占比", span: 4 },
        { id: "w-funnel-1", type: "funnel", title: "销售漏斗", span: 4 },
        { id: "w-table-1", type: "table", title: "重点商机明细", span: 4 },
      ]
    : [
        { id: "w-kpi-1", type: "kpi", title: "月度营收", span: 3 },
        { id: "w-kpi-2", type: "kpi", title: "订单总额", span: 3 },
        { id: "w-kpi-3", type: "kpi", title: "客户数", span: 3 },
        { id: "w-kpi-4", type: "kpi", title: "回款率", span: 3 },
        { id: "w-bar-1", type: "bar", title: "月度销售趋势", span: 8 },
        { id: "w-gauge-1", type: "gauge", title: "目标完成率", span: 4 },
        { id: "w-pie-1", type: "pie", title: "产品类别分布", span: 4 },
        { id: "w-line-1", type: "line", title: "客户增长曲线", span: 4 },
        { id: "w-area-1", type: "area", title: "区域业绩对比", span: 4 },
        { id: "w-table-1", type: "table", title: "销售排行", span: 12 },
      ];

  return [{
    id: "report-config",
    type: "report-config",
    label: "报表配置",
    props: { widgets },
  }];
}

/* ══════════════════════════════════════════════════════════════
 *  流程页面 Mock 数据
 * ══════════════════════════════════════════════════════════════ */

export function mockWorkflowPage(pageName: string): PageComponent[] {
  const isContract = pageName.includes("合同");

  const nodes = isContract
    ? [
        { id: "start", type: "start", label: "发起", x: 50, y: 200 },
        { id: "task1", type: "task", label: "合同起草", x: 220, y: 200 },
        { id: "task2", type: "task", label: "法务审核", x: 390, y: 200 },
        { id: "gw", type: "gateway", label: "审核判断", x: 560, y: 200 },
        { id: "task3", type: "task", label: "签订合同", x: 730, y: 120 },
        { id: "task4", type: "task", label: "退回修改", x: 730, y: 280 },
        { id: "task5", type: "task", label: "归档", x: 900, y: 200 },
        { id: "end", type: "end", label: "完成", x: 1070, y: 200 },
      ]
    : [
        { id: "start", type: "start", label: "开始", x: 50, y: 200 },
        { id: "task1", type: "task", label: "提交申请", x: 220, y: 200 },
        { id: "gw", type: "gateway", label: "审批判断", x: 390, y: 200 },
        { id: "task2", type: "task", label: "审批通过", x: 560, y: 120 },
        { id: "task3", type: "task", label: "审批驳回", x: 560, y: 280 },
        { id: "task4", type: "task", label: "执行操作", x: 730, y: 200 },
        { id: "end", type: "end", label: "结束", x: 900, y: 200 },
      ];

  const connections = isContract
    ? [
        { id: "c1", from: "start", to: "task1", label: "" },
        { id: "c2", from: "task1", to: "task2", label: "" },
        { id: "c3", from: "task2", to: "gw", label: "" },
        { id: "c4", from: "gw", to: "task3", label: "通过" },
        { id: "c5", from: "gw", to: "task4", label: "驳回" },
        { id: "c6", from: "task3", to: "task5", label: "" },
        { id: "c7", from: "task4", to: "task1", label: "重新起草" },
        { id: "c8", from: "task5", to: "end", label: "" },
      ]
    : [
        { id: "c1", from: "start", to: "task1", label: "" },
        { id: "c2", from: "task1", to: "gw", label: "" },
        { id: "c3", from: "gw", to: "task2", label: "通过" },
        { id: "c4", from: "gw", to: "task3", label: "驳回" },
        { id: "c5", from: "task2", to: "task4", label: "" },
        { id: "c6", from: "task3", to: "task1", label: "退回" },
        { id: "c7", from: "task4", to: "end", label: "" },
      ];

  return [{
    id: "flow-config",
    type: "flow-config",
    label: "流程配置",
    props: { nodes, connections },
  }];
}

/* ══════════════════════════════════════════════════════════════
 *  BI / Agent 页面 Mock 数据
 * ══════════════════════════════════════════════════════════════ */

export function mockBIPage(pageName: string): PageComponent[] {
  return [{
    id: "bi-config",
    type: "bi-config",
    label: "BI配置",
    props: {
      agents: [
        { id: "a1", name: "销售助手", model: "GPT-4", status: "active", description: "辅助销售团队进行客户跟进和商机管理" },
        { id: "a2", name: "客服机器人", model: "GPT-3.5", status: "active", description: "处理客户咨询和常见问题回复" },
        { id: "a3", name: "数据分析员", model: "GPT-4", status: "active", description: "自动生成数据分析报告和洞察" },
        { id: "a4", name: "合同审查员", model: "GPT-4", status: "draft", description: "自动审查合同条款合规性" },
      ],
      tasks: [
        { id: "t1", name: "每日销售报表", schedule: "每天 08:00", status: "active", lastRun: "2026-07-06 08:00" },
        { id: "t2", name: "周度客户分析", schedule: "每周一 09:00", status: "active", lastRun: "2026-07-06 09:00" },
        { id: "t3", name: "月度模型微调", schedule: "每月 1 日 02:00", status: "active", lastRun: "2026-07-01 02:00" },
        { id: "t4", name: "季度趋势预测", schedule: "每季度首日", status: "draft" },
      ],
      metrics: [
        { id: "m1", name: "API 调用量", value: "15,832", unit: "次/天", trend: "up", icon: "zap" },
        { id: "m2", name: "平均响应时间", value: "198", unit: "ms", trend: "down", icon: "clock" },
        { id: "m3", name: "模型准确率", value: "96.5", unit: "%", trend: "up", icon: "target" },
        { id: "m4", name: "活跃 Agent", value: "3", unit: "个", trend: "flat", icon: "bot" },
        { id: "m5", name: "数据处理量", value: "2.8", unit: "GB/天", trend: "up", icon: "database" },
        { id: "m6", name: "任务成功率", value: "99.2", unit: "%", trend: "up", icon: "cpu" },
      ],
    },
  }];
}

/* ══════════════════════════════════════════════════════════════
 *  Mock 数据分发器
 * ══════════════════════════════════════════════════════════════ */

export function getMockComponents(pageType: string, pageName: string): PageComponent[] {
  switch (pageType) {
    case "list":
      return mockListPage(pageName);
    case "form":
    case "lowcode":
    case "procode":
    case "ai":
    case "custom":
      return mockFormPage(pageName);
    case "dashboard":
    case "report":
      return mockReportPage(pageName);
    case "workflow":
      return mockWorkflowPage(pageName);
    case "bi":
    case "analytics":
      return mockBIPage(pageName);
    default:
      return mockFormPage(pageName);
  }
}
