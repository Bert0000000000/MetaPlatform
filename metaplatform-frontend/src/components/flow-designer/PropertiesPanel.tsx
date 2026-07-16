/**
 * PropertiesPanel — Right sidebar for editing node and edge properties.
 *
 * Uses a field-definition registry per node type so each BPMN element
 * gets exactly the fields it needs, organized in clear sections.
 *
 * BPMN 2.0 field coverage per element type:
 *
 *   Start Event       → name, timerDefinition, messageRef
 *   End Event         → name, errorCode, terminate
 *   Timer Event       → name, timerType, timerValue
 *   Message Event     → name, messageRef
 *   User Task         → name, assignee, candidateUsers, candidateGroups,
 *                       formKey, dueDate, priority, description
 *   Service Task      → name, delegateExpression, serviceType, resultVariable, description
 *   Script Task       → name, scriptFormat, script
 *   Business Rule     → name, ruleLanguage, ruleVariable, inputVariable, description
 *   AI Decision       → name, aiModel, promptTemplate, inputVariables, description
 *   Call Activity     → name, calledElement
 *   Exclusive GW      → name, defaultFlow
 *   Parallel GW       → name
 *   Inclusive GW      → name, defaultFlow
 *   Event GW          → name
 *   Subprocess        → name
 *   Group             → name
 *   Event Subprocess  → name, triggerType, triggerRef
 *   Text Annotation   → text
 *   Sequence Flow     → name, conditionExpression
 */
import { useCallback, useEffect, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Trash2, X } from "lucide-react";
import { bpmnNodeTypeRegistry } from "./BpmnNodes";

// ==================== Field Definition Types ====================

type FieldKind = "text" | "textarea" | "select" | "pageSelect" | "readonly" | "fieldPermissions";

export interface FieldPermissionItem {
  key: string;
  permission: "visible" | "editable" | "hidden" | "readonly";
}

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  mono?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
}

interface FieldSection {
  title?: string;
  fields: FieldDef[];
}

// ==================== Field Registry ====================

const NODE_FIELDS: Record<string, FieldSection[]> = {
  // ── Events ──
  startEvent: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "开始事件" },
      ],
    },
    {
      title: "事件定义",
      fields: [
        { key: "timerDefinition", label: "定时器定义", kind: "text", placeholder: "P5D, ${dueDate}, 2025-12-31" },
        { key: "messageRef", label: "消息引用", kind: "text", placeholder: "Message_ID" },
      ],
    },
  ],
  endEvent: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "结束事件" },
      ],
    },
    {
      title: "事件定义",
      fields: [
        { key: "errorCode", label: "错误码", kind: "text", placeholder: "ERROR_CODE" },
        { key: "terminate", label: "终止", kind: "select", options: [
          { value: "false", label: "否" },
          { value: "true", label: "是 — 终止所有实例" },
        ]},
      ],
    },
  ],
  timerEvent: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "定时器" },
      ],
    },
    {
      title: "定时器定义",
      fields: [
        { key: "timerType", label: "定时器类型", kind: "select", options: [
          { value: "date", label: "日期 — 具体时间点" },
          { value: "duration", label: "持续时间 — 时段" },
          { value: "cycle", label: "周期 — 重复间隔" },
        ]},
        { key: "timerValue", label: "定时器值", kind: "text", placeholder: "P3D, PT4H, R/PT1H", mono: true },
      ],
    },
  ],
  messageEvent: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "消息" },
      ],
    },
    {
      title: "消息定义",
      fields: [
        { key: "messageRef", label: "消息引用", kind: "text", placeholder: "Message_ID" },
      ],
    },
  ],

  // ── Tasks ──
  userTask: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "用户任务" },
      ],
    },
    {
      title: "分配",
      fields: [
        { key: "assignee", label: "办理人", kind: "text", placeholder: "user001 或 ${initiator}" },
        { key: "candidateUsers", label: "候选人", kind: "text", placeholder: "user001,user002" },
        { key: "candidateGroups", label: "候选组", kind: "text", placeholder: "managers,finance" },
      ],
    },
    {
      title: "任务配置",
      fields: [
        { key: "formKey", label: "表单键", kind: "pageSelect" },
        { key: "dueDate", label: "到期日", kind: "text", placeholder: "P3D 或 ${dueDate}" },
        { key: "priority", label: "优先级", kind: "text", placeholder: "50" },
        { key: "description", label: "描述", kind: "textarea", placeholder: "任务描述…" },
      ],
    },
    {
      title: "字段权限",
      fields: [{ key: "fieldPermissions", label: "字段权限", kind: "fieldPermissions" }],
    },
  ],
  serviceTask: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "服务任务" },
      ],
    },
    {
      title: "实现",
      fields: [
        { key: "serviceType", label: "服务类型", kind: "select", options: [
          { value: "delegate", label: "委托表达式" },
          { value: "class", label: "Java 类" },
          { value: "connector", label: "外部连接器" },
        ]},
        { key: "delegateExpression", label: "委托表达式", kind: "text", placeholder: "${myDelegate}", mono: true },
        { key: "resultVariable", label: "结果变量", kind: "text", placeholder: "resultVar" },
        { key: "description", label: "描述", kind: "textarea", placeholder: "服务描述…" },
      ],
    },
  ],
  scriptTask: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "脚本任务" },
      ],
    },
    {
      title: "脚本",
      fields: [
        { key: "scriptFormat", label: "脚本格式", kind: "select", options: [
          { value: "groovy", label: "Groovy" },
          { value: "javascript", label: "JavaScript" },
          { value: "python", label: "Python" },
          { value: "java", label: "Java" },
        ]},
        { key: "script", label: "脚本内容", kind: "textarea", placeholder: "execution.setVariable('result', 'ok')", mono: true, rows: 6 },
      ],
    },
  ],
  businessRuleTask: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "业务规则" },
      ],
    },
    {
      title: "规则配置",
      fields: [
        { key: "ruleLanguage", label: "规则语言", kind: "select", options: [
          { value: "drl", label: "DRL (Drools)" },
          { value: "dmn", label: "DMN（决策模型）" },
          { value: "mvel", label: "MVEL" },
        ]},
        { key: "ruleVariable", label: "规则变量", kind: "text", placeholder: "rules" },
        { key: "inputVariable", label: "输入变量", kind: "text", placeholder: "input" },
        { key: "description", label: "描述", kind: "textarea", placeholder: "业务规则描述…" },
      ],
    },
  ],
  approvalTask: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "审批" },
      ],
    },
    {
      title: "审批人",
      fields: [
        { key: "approverType", label: "审批人类型", kind: "select", options: [
          { value: "assignee", label: "指定审批人" },
          { value: "candidateUsers", label: "候选人" },
          { value: "candidateGroups", label: "候选组" },
          { value: "role", label: "按角色" },
          { value: "dept_manager", label: "部门主管" },
          { value: "initiator", label: "发起人自选" },
        ]},
        { key: "approverValue", label: "审批人/组", kind: "text", placeholder: "user001 或 managers,finance" },
      ],
    },
    {
      title: "审批规则",
      fields: [
        { key: "approvalType", label: "审批方式", kind: "select", options: [
          { value: "or", label: "或签（任一人通过）" },
          { value: "and", label: "会签（所有人通过）" },
          { value: "sequential", label: "依次审批" },
          { value: "countersign", label: "会签（按比例）" },
        ]},
        { key: "approvalRatio", label: "通过比例", kind: "text", placeholder: "0.6（60%通过）" },
        { key: "dueDate", label: "审批时限", kind: "text", placeholder: "P3D 或 24h" },
      ],
    },
    {
      title: "审批表单",
      fields: [
        { key: "formKey", label: "表单模板", kind: "pageSelect" },
        { key: "hideButtons", label: "隐藏按钮", kind: "select", options: [
          { value: "", label: "不隐藏" },
          { value: "reject", label: "隐藏驳回" },
          { value: "delegate", label: "隐藏转办" },
          { value: "reject,delegate", label: "隐藏驳回和转办" },
        ]},
        { key: "allowDelegate", label: "允许转办", kind: "select", options: [
          { value: "true", label: "允许" },
          { value: "false", label: "不允许" },
        ]},
        { key: "allowAddSign", label: "允许加签", kind: "select", options: [
          { value: "true", label: "允许" },
          { value: "false", label: "不允许" },
        ]},
        { key: "description", label: "描述", kind: "textarea", placeholder: "审批说明…" },
      ],
    },
    {
      title: "字段权限",
      fields: [{ key: "fieldPermissions", label: "字段权限", kind: "fieldPermissions" }],
    },
  ],
  aiDecision: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "AI 决策" },
      ],
    },
    {
      title: "AI 配置",
      fields: [
        { key: "aiModel", label: "AI 模型", kind: "select", options: [
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "claude-3", label: "Claude 3" },
          { value: "deepseek", label: "DeepSeek" },
          { value: "qwen", label: "Qwen" },
          { value: "local", label: "本地模型" },
        ]},
        { key: "promptTemplate", label: "提示词模板", kind: "textarea", placeholder: "你是一个有帮助的助手，…", rows: 4 },
        { key: "inputVariables", label: "输入变量", kind: "text", placeholder: "var1,var2,var3" },
        { key: "outputVariable", label: "输出变量", kind: "text", placeholder: "aiResult" },
        { key: "description", label: "描述", kind: "textarea", placeholder: "AI 决策描述…" },
      ],
    },
  ],
  callActivity: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "调用活动" },
      ],
    },
    {
      title: "被调用方",
      fields: [
        { key: "calledElement", label: "被调用元素", kind: "text", placeholder: "processId_to_call", mono: true },
      ],
    },
  ],

  // ── Gateways ──
  exclusiveGateway: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "互斥" },
      ],
    },
    {
      title: "路由",
      fields: [
        { key: "defaultFlow", label: "默认流", kind: "text", placeholder: "SequenceFlow_ID" },
      ],
    },
  ],
  parallelGateway: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "并行" },
      ],
    },
  ],
  inclusiveGateway: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "包容" },
      ],
    },
    {
      title: "路由",
      fields: [
        { key: "defaultFlow", label: "默认流", kind: "text", placeholder: "SequenceFlow_ID" },
      ],
    },
  ],
  eventGateway: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "事件" },
      ],
    },
  ],

  // ── Containers ──
  subprocess: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "子流程" },
      ],
    },
  ],
  group: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "分组" },
      ],
    },
  ],
  eventSubprocess: [
    {
      fields: [
        { key: "label", label: "名称", kind: "text", placeholder: "事件子流程" },
      ],
    },
    {
      title: "触发器",
      fields: [
        { key: "triggerType", label: "触发器类型", kind: "select", options: [
          { value: "start", label: "开始" },
          { value: "end", label: "结束" },
        ]},
        { key: "triggerRef", label: "触发器引用", kind: "text", placeholder: "Message_ID, Error_Code" },
      ],
    },
  ],

  // ── Artifacts ──
  textAnnotation: [
    {
      fields: [
        { key: "annotationText", label: "文本", kind: "textarea", placeholder: "批注文本…" },
      ],
    },
  ],
};

const EDGE_FIELDS: FieldSection[] = [
  {
    fields: [
      { key: "label", label: "名称", kind: "text", placeholder: "连线标签" },
    ],
  },
  {
    title: "条件",
    fields: [
      {
        key: "conditionExpression",
        label: "条件表达式",
        kind: "textarea",
        placeholder: "${amount > 10000}",
        mono: true,
        rows: 3,
      },
    ],
  },
];

// ==================== Component ====================

interface PropertiesPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  onUpdateEdge: (edgeId: string, data: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeselect: () => void;
  processConfig: { id: string; name: string };
  onUpdateProcess: (config: { id: string; name: string }) => void;
  /** 可选：当前工作流所属模块下的相关页面，供 Form Key / 表单模板 选择 */
  formPageOptions?: { value: string; label: string }[];
  /** 可选：当前表单字段列表，供字段权限配置使用 */
  formFields?: { key: string; label?: string }[];
}

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onDeselect,
  processConfig,
  onUpdateProcess,
  formPageOptions = [],
  formFields = [],
}: PropertiesPanelProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Sync form when selection changes
  useEffect(() => {
    if (selectedNode) {
      const data = selectedNode.data as Record<string, unknown>;
      const sections = NODE_FIELDS[selectedNode.type || ""];
      if (!sections) {
        setFormData({ label: String(data.label || "") });
        return;
      }
      const form: Record<string, string> = {};
      for (const sec of sections) {
        for (const f of sec.fields) {
          if (f.key === "label") {
            form[f.key] = String(data.label || "");
          } else if (f.key === "annotationText") {
            form[f.key] = String(data.label || data.text || "");
          } else if (f.key === "fieldPermissions") {
            const fp = data.fieldPermissions;
            form[f.key] = Array.isArray(fp) ? JSON.stringify(fp) : "";
          } else {
            form[f.key] = String(data[f.key] ?? "");
          }
        }
      }
      setFormData(form);
    } else if (selectedEdge) {
      const form: Record<string, string> = {};
      for (const sec of EDGE_FIELDS) {
        for (const f of sec.fields) {
          if (f.key === "label") {
            form[f.key] = String(selectedEdge.label || "");
          } else {
            form[f.key] = String((selectedEdge.data as Record<string, unknown>)?.[f.key] ?? "");
          }
        }
      }
      setFormData(form);
    }
  }, [selectedNode, selectedEdge]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (selectedNode) {
      const data: Record<string, unknown> = {};
      // label → node data label
      if (formData.label !== undefined) data.label = formData.label;
      // annotationText → label for textAnnotation
      if (selectedNode.type === "textAnnotation") {
        data.label = formData.annotationText || "";
      }
      // copy all other fields into data
      const sections = NODE_FIELDS[selectedNode.type || ""];
      if (sections) {
        for (const sec of sections) {
          for (const f of sec.fields) {
            if (f.key === "label" || f.key === "annotationText") continue;
            if (formData[f.key] === undefined || formData[f.key] === "") continue;
            if (f.key === "fieldPermissions") {
              try {
                const parsed = JSON.parse(formData[f.key]);
                if (Array.isArray(parsed) && parsed.length > 0) data[f.key] = parsed;
              } catch {
                // ignore malformed JSON
              }
            } else {
              data[f.key] = formData[f.key];
            }
          }
        }
      }
      onUpdateNode(selectedNode.id, data);
    } else if (selectedEdge) {
      const data: Record<string, unknown> = {};
      for (const sec of EDGE_FIELDS) {
        for (const f of sec.fields) {
          if (f.key === "label") {
            data.label = formData[f.key] || "";
          } else if (formData[f.key] !== undefined && formData[f.key] !== "") {
            data[f.key] = formData[f.key];
          }
        }
      }
      onUpdateEdge(selectedEdge.id, data);
    }
  }, [selectedNode, selectedEdge, formData, onUpdateNode, onUpdateEdge]);

  const meta = selectedNode
    ? bpmnNodeTypeRegistry.find((m) => m.type === selectedNode.type)
    : null;

  const sections = selectedNode ? NODE_FIELDS[selectedNode.type || ""] : null;

  // ── No selection: process config ──
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b">
          <h3 className="text-sm font-semibold text-foreground">流程属性</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">流程 ID</Label>
            <Input
              value={processConfig.id}
              onChange={(e) => onUpdateProcess({ ...processConfig, id: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="myProcess"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">流程名称</Label>
            <Input
              value={processConfig.name}
              onChange={(e) => onUpdateProcess({ ...processConfig, name: e.target.value })}
              className="h-8 text-xs"
              placeholder="My Process"
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Edge selected ──
  if (selectedEdge) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">连线属性</h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-6" onClick={() => onDeleteEdge(selectedEdge.id)}>
              <Trash2 className="size-3 text-destructive" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={onDeselect}>
              <X className="size-3" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ID</Label>
            <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5 break-all">
              {selectedEdge.id}
            </div>
          </div>
          {EDGE_FIELDS.map((sec, si) => (
            <div key={si} className="space-y-2">
              {sec.title && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{sec.title}</p>
              )}
              {sec.fields.map((f) => renderField(f, formData, handleFieldChange, formPageOptions, formFields))}
            </div>
          ))}
          <Button size="sm" className="w-full" onClick={handleSave}>应用</Button>
        </div>
      </div>
    );
  }

  // ── Node selected ──
  if (!selectedNode) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {meta && (
            <div className="flex items-center justify-center rounded size-5 shrink-0" style={{ background: "#f3f1ee" }}>
              <meta.Icon className="size-3" style={{ color: "#94a3b8" }} />
            </div>
          )}
          <h3 className="text-sm font-semibold text-foreground truncate">
            {meta?.label || selectedNode.type}
          </h3>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-6" onClick={() => onDeleteNode(selectedNode.id)}>
            <Trash2 className="size-3 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6" onClick={onDeselect}>
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Node ID (read-only) */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ID</Label>
          <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5 break-all">
            {selectedNode.id}
          </div>
        </div>

        {/* Dynamic sections */}
        {sections?.map((sec, si) => (
          <div key={si} className="space-y-2">
            {sec.title && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {sec.title}
              </p>
            )}
            {sec.fields.map((f) => renderField(f, formData, handleFieldChange, formPageOptions, formFields))}
          </div>
        ))}

        {/* Fallback for unknown types */}
        {!sections && (
          <div className="space-y-1.5">
            <Label className="text-xs">名称</Label>
            <Input
              value={formData.label || ""}
              onChange={(e) => handleFieldChange("label", e.target.value)}
              className="h-8 text-xs"
              placeholder="元素名称"
            />
          </div>
        )}

        <Button size="sm" className="w-full" onClick={handleSave}>应用</Button>
      </div>
    </div>
  );
}

// ==================== Field Renderer ====================

function renderField(
  f: FieldDef,
  formData: Record<string, string>,
  onChange: (field: string, value: string) => void,
  pageOptions: { value: string; label: string }[] = [],
  formFields: { key: string; label?: string }[] = [],
) {
  if (f.kind === "readonly") {
    return (
      <div key={f.key} className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{f.label}</Label>
        <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5 break-all">
          {formData[f.key] || "—"}
        </div>
      </div>
    );
  }

  if (f.kind === "select" && f.options) {
    return (
      <div key={f.key} className="space-y-1.5">
        <Label className="text-xs">{f.label}</Label>
        <Select value={formData[f.key] || ""} onValueChange={(val) => onChange(f.key, val)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="请选择…" />
          </SelectTrigger>
          <SelectContent>
            {f.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (f.kind === "pageSelect") {
    const options = pageOptions.length > 0 ? pageOptions : [{ value: "", label: "暂无可用页面" }];
    return (
      <div key={f.key} className="space-y-1.5">
        <Label className="text-xs">{f.label}</Label>
        <Select value={formData[f.key] || ""} onValueChange={(val) => onChange(f.key, val)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="选择模块内页面…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value || "__empty__"} value={opt.value} disabled={!opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (f.kind === "fieldPermissions") {
    const permissions: FieldPermissionItem[] = (() => {
      try {
        const parsed = JSON.parse(formData[f.key] || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    const update = (next: FieldPermissionItem[]) => {
      onChange(f.key, JSON.stringify(next));
    };
    const toggleField = (key: string, permission: FieldPermissionItem["permission"]) => {
      const filtered = permissions.filter((p) => p.key !== key);
      filtered.push({ key, permission });
      update(filtered);
    };
    const removeField = (key: string) => {
      update(permissions.filter((p) => p.key !== key));
    };
    const permissionOptions = [
      { value: "editable", label: "可编辑" },
      { value: "readonly", label: "只读" },
      { value: "visible", label: "可见" },
      { value: "hidden", label: "隐藏" },
    ];
    return (
      <div key={f.key} className="space-y-2">
        {formFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无可用表单字段，请先选择表单或配置表单字段。</p>
        ) : (
          formFields.map((field) => {
            const existing = permissions.find((p) => p.key === field.key);
            return (
              <div key={field.key} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 text-xs truncate" title={field.key}>
                  {field.label || field.key}
                </div>
                <Select
                  value={existing?.permission || "editable"}
                  onValueChange={(val) => toggleField(field.key, val as FieldPermissionItem["permission"])}
                >
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {permissionOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {existing && (
                  <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => removeField(field.key)}>
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (f.kind === "textarea") {
    return (
      <div key={f.key} className="space-y-1.5">
        <Label className="text-xs">{f.label}</Label>
        <Textarea
          value={formData[f.key] || ""}
          onChange={(e) => onChange(f.key, e.target.value)}
          className={`text-xs min-h-[${(f.rows || 3) * 20}px] ${f.mono ? "font-mono" : ""}`}
          placeholder={f.placeholder}
          rows={f.rows || 3}
        />
      </div>
    );
  }

  // Default: text input
  return (
    <div key={f.key} className="space-y-1.5">
      <Label className="text-xs">{f.label}</Label>
      <Input
        value={formData[f.key] || ""}
        onChange={(e) => onChange(f.key, e.target.value)}
        className={`h-8 text-xs ${f.mono ? "font-mono" : ""}`}
        placeholder={f.placeholder}
      />
    </div>
  );
}
