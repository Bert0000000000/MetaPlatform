/**
 * Seeded application templates.
 *
 * Each template declaratively describes:
 *   - ontology objects (with their fields)
 *   - app pages (list / form / dashboard)
 *   - process definitions (with a minimal bpmn xml)
 *
 * Routes/apps.js#POST / consumes a `template` key and applies the
 * matching seed to the freshly-created application so the user lands
 * on a usable application instead of an empty shell.
 *
 * Adding a new template = adding a new entry here AND surfacing it in
 * Dashboard.tsx#RECOMMENDED_TEMPLATES.
 */

const NOW = () => new Date().toISOString();

/* ────────────────────────────────────────────────────────────
 * CRM — 客户管理
 *   Objects: 客户 / 销售机会 / 跟进记录
 *   Pages:   客户列表、客户表单、销售看板
 *   Process: 销售机会流程
 * ──────────────────────────────────────────────────────────── */
const CRM_TEMPLATE = {
  objects: [
    {
      name: "customer",
      label: "客户",
      description: "客户主数据，记录联系人、来源、等级、负责人",
      icon: "Users",
      properties: [
        { name: "name",        label: "客户名称", type: "text",     required: 1, sort_order: 0 },
        { name: "contact",     label: "联系人",   type: "text",     required: 1, sort_order: 1 },
        { name: "phone",       label: "联系电话", type: "phone",    required: 0, sort_order: 2 },
        { name: "email",       label: "邮箱",     type: "email",    required: 0, sort_order: 3 },
        { name: "level",       label: "客户等级", type: "select",   required: 1, sort_order: 4, default_value: "C" },
        { name: "source",      label: "客户来源", type: "select",   required: 0, sort_order: 5 },
        { name: "owner",       label: "负责人",   type: "text",     required: 0, sort_order: 6 },
        { name: "remark",      label: "备注",     type: "textarea", required: 0, sort_order: 7 },
      ],
    },
    {
      name: "opportunity",
      label: "销售机会",
      description: "销售阶段跟踪，从初步接触到签约",
      icon: "Target",
      properties: [
        { name: "name",      label: "机会名称",     type: "text",   required: 1, sort_order: 0 },
        { name: "amount",    label: "预计金额(元)", type: "number", required: 0, sort_order: 1 },
        { name: "stage",     label: "阶段",         type: "select", required: 1, sort_order: 2, default_value: "lead" },
        { name: "expected",  label: "预计成交日",   type: "date",   required: 0, sort_order: 3 },
        { name: "owner",     label: "负责人",       type: "text",   required: 0, sort_order: 4 },
      ],
    },
    {
      name: "activity",
      label: "跟进记录",
      description: "客户/机会的每次跟进沟通记录",
      icon: "Activity",
      properties: [
        { name: "subject", label: "主题",   type: "text",     required: 1, sort_order: 0 },
        { name: "type",    label: "方式",   type: "select",   required: 1, sort_order: 1, default_value: "phone" },
        { name: "happened_at", label: "时间", type: "datetime", required: 0, sort_order: 2 },
        { name: "note",    label: "内容",   type: "textarea", required: 0, sort_order: 3 },
      ],
    },
  ],
  pages: [
    { name: "客户列表",   type: "list",     icon: "Users",   sort_order: 0 },
    { name: "客户表单",   type: "form",     icon: "FileText", sort_order: 1 },
    { name: "销售看板",   type: "dashboard", icon: "BarChart3", sort_order: 2 },
  ],
  flows: [
    {
      name: "销售机会流程",
      type: "business",
      description: "线索 → 初步接触 → 需求确认 → 方案报价 → 谈判 → 签约",
      bpmn_xml: buildBpmnXml("销售机会流程", [
        { id: "start", name: "新增机会" },
        { id: "contact", name: "初步接触" },
        { id: "qualify", name: "需求确认" },
        { id: "quote", name: "方案报价" },
        { id: "negotiate", name: "商务谈判" },
        { id: "win", name: "签约成交" },
        { id: "end", name: "结束" },
      ], [
        ["start", "contact"],
        ["contact", "qualify"],
        ["qualify", "quote"],
        ["quote", "negotiate"],
        ["negotiate", "win"],
        ["win", "end"],
      ]),
    },
  ],
};

/* ────────────────────────────────────────────────────────────
 * BI — 数据分析
 *   Objects: 销售指标 / 维度标签
 *   Pages:   销售总览、指标列表
 *   Process: 月度报表流程
 * ──────────────────────────────────────────────────────────── */
const BI_TEMPLATE = {
  objects: [
    {
      name: "kpi",
      label: "销售指标",
      description: "可按月/季度跟踪的销售额、订单数、客单价等指标",
      icon: "BarChart3",
      properties: [
        { name: "name",     label: "指标名称", type: "text",   required: 1, sort_order: 0 },
        { name: "value",    label: "数值",     type: "number", required: 1, sort_order: 1 },
        { name: "unit",     label: "单位",     type: "text",   required: 0, sort_order: 2 },
        { name: "period",   label: "周期",     type: "select", required: 1, sort_order: 3, default_value: "monthly" },
        { name: "category", label: "分类",     type: "select", required: 0, sort_order: 4 },
      ],
    },
    {
      name: "dimension",
      label: "分析维度",
      description: "维度表：区域、产品线、渠道等切片维度",
      icon: "Columns",
      properties: [
        { name: "name",  label: "维度",   type: "text",   required: 1, sort_order: 0 },
        { name: "type",  label: "类型",   type: "select", required: 1, sort_order: 1, default_value: "category" },
        { name: "order", label: "排序",   type: "number", required: 0, sort_order: 2 },
      ],
    },
  ],
  pages: [
    { name: "销售总览", type: "dashboard", icon: "PieChart", sort_order: 0 },
    { name: "指标列表", type: "list",      icon: "BarChart3", sort_order: 1 },
  ],
  flows: [
    {
      name: "月度报表流程",
      type: "business",
      description: "数据采集 → 校验 → 生成 → 审核 → 发布",
      bpmn_xml: buildBpmnXml("月度报表流程", [
        { id: "start",   name: "周期开始" },
        { id: "collect", name: "数据采集" },
        { id: "validate", name: "数据校验" },
        { id: "generate", name: "报表生成" },
        { id: "review",  name: "主管审核" },
        { id: "publish", name: "发布订阅" },
        { id: "end",     name: "结束" },
      ], [
        ["start", "collect"],
        ["collect", "validate"],
        ["validate", "generate"],
        ["generate", "review"],
        ["review", "publish"],
        ["publish", "end"],
      ]),
    },
  ],
};

/* ────────────────────────────────────────────────────────────
 * BPM — 流程管理
 *   Objects: 请假单 / 报销单
 *   Pages:   我的申请、审批列表
 *   Process: 请假审批、报销审批
 * ──────────────────────────────────────────────────────────── */
const BPM_TEMPLATE = {
  objects: [
    {
      name: "leave",
      label: "请假单",
      description: "员工请假申请，含类型、天数、起止日期",
      icon: "ClipboardList",
      properties: [
        { name: "applicant",  label: "申请人",     type: "text", required: 1, sort_order: 0 },
        { name: "type",       label: "假别",       type: "select", required: 1, sort_order: 1, default_value: "annual" },
        { name: "start_date", label: "开始日期",   type: "date",   required: 1, sort_order: 2 },
        { name: "end_date",   label: "结束日期",   type: "date",   required: 1, sort_order: 3 },
        { name: "days",       label: "天数",       type: "number", required: 0, sort_order: 4 },
        { name: "reason",     label: "原因",       type: "textarea", required: 0, sort_order: 5 },
      ],
    },
    {
      name: "expense",
      label: "报销单",
      description: "日常费用报销申请",
      icon: "CreditCard",
      properties: [
        { name: "applicant", label: "申请人",   type: "text",     required: 1, sort_order: 0 },
        { name: "category",  label: "类别",     type: "select",   required: 1, sort_order: 1, default_value: "travel" },
        { name: "amount",    label: "金额(元)", type: "number",   required: 1, sort_order: 2 },
        { name: "incurred",  label: "发生日期", type: "date",     required: 1, sort_order: 3 },
        { name: "remark",    label: "说明",     type: "textarea", required: 0, sort_order: 4 },
      ],
    },
  ],
  pages: [
    { name: "我的申请", type: "list", icon: "ClipboardList", sort_order: 0 },
    { name: "审批列表", type: "list", icon: "CheckCircle2", sort_order: 1 },
  ],
  flows: [
    {
      name: "请假审批流程",
      type: "approval",
      description: "员工提交 → 直属上级 → 部门负责人 → HR 备案",
      bpmn_xml: buildBpmnXml("请假审批流程", [
        { id: "start",  name: "提交申请" },
        { id: "lead",   name: "直属上级" },
        { id: "dept",   name: "部门负责人" },
        { id: "hr",     name: "HR 备案" },
        { id: "end",    name: "结束" },
      ], [
        ["start", "lead"],
        ["lead", "dept"],
        ["dept", "hr"],
        ["hr", "end"],
      ]),
    },
    {
      name: "报销审批流程",
      type: "approval",
      description: "员工提交 → 直属上级 → 财务审核 → 出纳支付",
      bpmn_xml: buildBpmnXml("报销审批流程", [
        { id: "start",   name: "提交申请" },
        { id: "lead",    name: "直属上级" },
        { id: "finance", name: "财务审核" },
        { id: "pay",     name: "出纳支付" },
        { id: "end",     name: "结束" },
      ], [
        ["start", "lead"],
        ["lead", "finance"],
        ["finance", "pay"],
        ["pay", "end"],
      ]),
    },
  ],
};

const TEMPLATES = {
  crm: CRM_TEMPLATE,
  bi: BI_TEMPLATE,
  bpm: BPM_TEMPLATE,
};

/**
 * Tiny BPMN-flavored xml builder. We store *something* in bpmn_xml so
 * the renderer has a graph to draw; it doesn't need to be a fully
 * executable BPMN 2.0 spec for the demo template.
 */
function buildBpmnXml(name, nodes, edges) {
  const nodeXml = nodes.map((n) =>
    `<bpmn:task id="${n.id}" name="${escapeXml(n.name)}"/>`,
  ).join("");
  const startEnd = (id) =>
    `<bpmn:${id === "start" ? "startEvent" : "endEvent"} id="${id}" name="${id === "start" ? "开始" : "结束"}"/>`;
  const flow = edges
    .map(([from, to]) => `<bpmn:sequenceFlow id="flow_${from}_${to}" sourceRef="${from}" targetRef="${to}"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  id="Definitions_${escapeXml(name)}"
                  targetNamespace="http://metaplatform.local/bpmn">
  <bpmn:process id="${escapeXml(name)}" name="${escapeXml(name)}" isExecutable="false">
    ${startEnd("start")}
    ${nodeXml}
    ${startEnd("end")}
    ${flow}
  </bpmn:process>
</bpmn:definitions>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (ch) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[ch]);
}

/**
 * Materialize a template for an application row. Returns a summary
 * { objects, pages, flows } with counts so the route can persist the
 * seeded rows AND update the application's objects_count / pages_count
 * / flows_count columns.
 *
 * If the key is unknown this returns null so the caller can short-
 * circuit (i.e. behave like the old "empty shell" install).
 */
function buildTemplateSeed(key) {
  const tpl = TEMPLATES[key];
  if (!tpl) return null;
  return {
    objects: tpl.objects.map((o) => ({ ...o, properties: o.properties || [] })),
    pages:   tpl.pages.map((p) => ({ ...p })),
    flows:   tpl.flows.map((f) => ({ ...f })),
  };
}

function listTemplateKeys() {
  return Object.keys(TEMPLATES);
}

export { TEMPLATES, buildTemplateSeed, listTemplateKeys };
export default TEMPLATES;
