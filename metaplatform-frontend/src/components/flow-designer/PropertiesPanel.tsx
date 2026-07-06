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

type FieldKind = "text" | "textarea" | "select" | "readonly";

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
        { key: "label", label: "Name", kind: "text", placeholder: "Start Event" },
      ],
    },
    {
      title: "Event Definition",
      fields: [
        { key: "timerDefinition", label: "Timer Definition", kind: "text", placeholder: "P5D, ${dueDate}, 2025-12-31" },
        { key: "messageRef", label: "Message Reference", kind: "text", placeholder: "Message_ID" },
      ],
    },
  ],
  endEvent: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "End Event" },
      ],
    },
    {
      title: "Event Definition",
      fields: [
        { key: "errorCode", label: "Error Code", kind: "text", placeholder: "ERROR_CODE" },
        { key: "terminate", label: "Terminate", kind: "select", options: [
          { value: "false", label: "No" },
          { value: "true", label: "Yes — terminate all instances" },
        ]},
      ],
    },
  ],
  timerEvent: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Timer" },
      ],
    },
    {
      title: "Timer Definition",
      fields: [
        { key: "timerType", label: "Timer Type", kind: "select", options: [
          { value: "date", label: "Date — specific point in time" },
          { value: "duration", label: "Duration — time period" },
          { value: "cycle", label: "Cycle — repeating interval" },
        ]},
        { key: "timerValue", label: "Timer Value", kind: "text", placeholder: "P3D, PT4H, R/PT1H", mono: true },
      ],
    },
  ],
  messageEvent: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Message" },
      ],
    },
    {
      title: "Message Definition",
      fields: [
        { key: "messageRef", label: "Message Reference", kind: "text", placeholder: "Message_ID" },
      ],
    },
  ],

  // ── Tasks ──
  userTask: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "User Task" },
      ],
    },
    {
      title: "Assignment",
      fields: [
        { key: "assignee", label: "Assignee", kind: "text", placeholder: "user001 or ${initiator}" },
        { key: "candidateUsers", label: "Candidate Users", kind: "text", placeholder: "user001,user002" },
        { key: "candidateGroups", label: "Candidate Groups", kind: "text", placeholder: "managers,finance" },
      ],
    },
    {
      title: "Task Config",
      fields: [
        { key: "formKey", label: "Form Key", kind: "text", placeholder: "forms/apply.html" },
        { key: "dueDate", label: "Due Date", kind: "text", placeholder: "P3D or ${dueDate}" },
        { key: "priority", label: "Priority", kind: "text", placeholder: "50" },
        { key: "description", label: "Description", kind: "textarea", placeholder: "Task description…" },
      ],
    },
  ],
  serviceTask: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Service Task" },
      ],
    },
    {
      title: "Implementation",
      fields: [
        { key: "serviceType", label: "Service Type", kind: "select", options: [
          { value: "delegate", label: "Delegate Expression" },
          { value: "class", label: "Java Class" },
          { value: "connector", label: "External Connector" },
        ]},
        { key: "delegateExpression", label: "Delegate Expression", kind: "text", placeholder: "${myDelegate}", mono: true },
        { key: "resultVariable", label: "Result Variable", kind: "text", placeholder: "resultVar" },
        { key: "description", label: "Description", kind: "textarea", placeholder: "Service description…" },
      ],
    },
  ],
  scriptTask: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Script Task" },
      ],
    },
    {
      title: "Script",
      fields: [
        { key: "scriptFormat", label: "Script Format", kind: "select", options: [
          { value: "groovy", label: "Groovy" },
          { value: "javascript", label: "JavaScript" },
          { value: "python", label: "Python" },
          { value: "java", label: "Java" },
        ]},
        { key: "script", label: "Script Body", kind: "textarea", placeholder: "execution.setVariable('result', 'ok')", mono: true, rows: 6 },
      ],
    },
  ],
  businessRuleTask: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Business Rule" },
      ],
    },
    {
      title: "Rule Configuration",
      fields: [
        { key: "ruleLanguage", label: "Rule Language", kind: "select", options: [
          { value: "drl", label: "DRL (Drools)" },
          { value: "dmn", label: "DMN (Decision Model)" },
          { value: "mvel", label: "MVEL" },
        ]},
        { key: "ruleVariable", label: "Rule Variable", kind: "text", placeholder: "rules" },
        { key: "inputVariable", label: "Input Variable", kind: "text", placeholder: "input" },
        { key: "description", label: "Description", kind: "textarea", placeholder: "Business rule description…" },
      ],
    },
  ],
  approvalTask: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Approval" },
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
        { key: "formKey", label: "表单模板", kind: "text", placeholder: "approval/standard.html" },
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
  ],
  aiDecision: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "AI Decision" },
      ],
    },
    {
      title: "AI Configuration",
      fields: [
        { key: "aiModel", label: "AI Model", kind: "select", options: [
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "claude-3", label: "Claude 3" },
          { value: "deepseek", label: "DeepSeek" },
          { value: "qwen", label: "Qwen" },
          { value: "local", label: "Local Model" },
        ]},
        { key: "promptTemplate", label: "Prompt Template", kind: "textarea", placeholder: "You are a helpful assistant that…", rows: 4 },
        { key: "inputVariables", label: "Input Variables", kind: "text", placeholder: "var1,var2,var3" },
        { key: "outputVariable", label: "Output Variable", kind: "text", placeholder: "aiResult" },
        { key: "description", label: "Description", kind: "textarea", placeholder: "AI decision description…" },
      ],
    },
  ],
  callActivity: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Call Activity" },
      ],
    },
    {
      title: "Callee",
      fields: [
        { key: "calledElement", label: "Called Element", kind: "text", placeholder: "processId_to_call", mono: true },
      ],
    },
  ],

  // ── Gateways ──
  exclusiveGateway: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "XOR" },
      ],
    },
    {
      title: "Routing",
      fields: [
        { key: "defaultFlow", label: "Default Flow", kind: "text", placeholder: "SequenceFlow_ID" },
      ],
    },
  ],
  parallelGateway: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "AND" },
      ],
    },
  ],
  inclusiveGateway: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "OR" },
      ],
    },
    {
      title: "Routing",
      fields: [
        { key: "defaultFlow", label: "Default Flow", kind: "text", placeholder: "SequenceFlow_ID" },
      ],
    },
  ],
  eventGateway: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Event" },
      ],
    },
  ],

  // ── Containers ──
  subprocess: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Subprocess" },
      ],
    },
  ],
  group: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Group" },
      ],
    },
  ],
  eventSubprocess: [
    {
      fields: [
        { key: "label", label: "Name", kind: "text", placeholder: "Event Subprocess" },
      ],
    },
    {
      title: "Trigger",
      fields: [
        { key: "triggerType", label: "Trigger Type", kind: "select", options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ]},
        { key: "triggerRef", label: "Trigger Reference", kind: "text", placeholder: "Message_ID, Error_Code" },
      ],
    },
  ],

  // ── Artifacts ──
  textAnnotation: [
    {
      fields: [
        { key: "annotationText", label: "Text", kind: "textarea", placeholder: "Annotation text…" },
      ],
    },
  ],
};

const EDGE_FIELDS: FieldSection[] = [
  {
    fields: [
      { key: "label", label: "Name", kind: "text", placeholder: "Flow label" },
    ],
  },
  {
    title: "Condition",
    fields: [
      {
        key: "conditionExpression",
        label: "Condition Expression",
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
            if (formData[f.key] !== undefined && formData[f.key] !== "") {
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
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{sec.title}</p>
              )}
              {sec.fields.map((f) => renderField(f, formData, handleFieldChange))}
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
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {sec.title}
              </p>
            )}
            {sec.fields.map((f) => renderField(f, formData, handleFieldChange))}
          </div>
        ))}

        {/* Fallback for unknown types */}
        {!sections && (
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={formData.label || ""}
              onChange={(e) => handleFieldChange("label", e.target.value)}
              className="h-8 text-xs"
              placeholder="Element name"
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
