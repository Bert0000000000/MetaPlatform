/**
 * Custom React Flow node components for BPMN 2.0 elements.
 * Each node has proper BPMN visual styling, Lucide icons, and connection handles.
 */
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Play,
  Octagon,
  User,
  Cog,
  Code,
  Layers,
  GitBranch,
  Plus,
  Circle,
  Clock,
  Mail,
  Box,
  Phone,
} from "lucide-react";

// ---------- Shared Handle Styles ----------

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  border: "2px solid #fff",
  background: "#6366f1",
};

const sourceHandleStyle: React.CSSProperties = { ...handleStyle };
const targetHandleStyle: React.CSSProperties = { ...handleStyle };

// ---------- Shared Types ----------

interface BpmnNodeData {
  label?: string;
  [key: string]: unknown;
}

// ==================== Start Event ====================

export const StartEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div
      className="relative"
      style={{ width: 40, height: 40 }}
    >
      <div
        className="flex items-center justify-center rounded-full border-2 transition-shadow"
        style={{
          width: 40,
          height: 40,
          borderColor: selected ? "#22c55e" : "#16a34a",
          background: selected ? "#dcfce7" : "#f0fdf4",
          boxShadow: selected ? "0 0 0 3px rgba(34,197,94,0.3)" : "none",
        }}
      >
        <Play className="size-4 text-green-600" />
      </div>
      {d.label && (
        <div
          className="absolute left-1/2 text-[11px] font-medium text-foreground whitespace-nowrap pointer-events-none"
          style={{ top: 46, transform: "translateX(-50%)" }}
        >
          {d.label}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
    </div>
  );
});
StartEventNode.displayName = "StartEventNode";

// ==================== End Event ====================

export const EndEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div
        className="flex items-center justify-center rounded-full border-[3px] transition-shadow"
        style={{
          width: 40,
          height: 40,
          borderColor: selected ? "#ef4444" : "#dc2626",
          background: selected ? "#fee2e2" : "#fef2f2",
          boxShadow: selected ? "0 0 0 3px rgba(239,68,68,0.3)" : "none",
        }}
      >
        <Octagon className="size-4 text-red-600" />
      </div>
      {d.label && (
        <div
          className="absolute left-1/2 text-[11px] font-medium text-foreground whitespace-nowrap pointer-events-none"
          style={{ top: 46, transform: "translateX(-50%)" }}
        >
          {d.label}
        </div>
      )}
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
    </div>
  );
});
EndEventNode.displayName = "EndEventNode";

// ==================== Timer Event ====================

export const TimerEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div
        className="flex items-center justify-center rounded-full border-2 transition-shadow"
        style={{
          width: 40,
          height: 40,
          borderColor: selected ? "#f59e0b" : "#d97706",
          background: selected ? "#fef3c7" : "#fffbeb",
          boxShadow: selected ? "0 0 0 3px rgba(245,158,11,0.3)" : "none",
        }}
      >
        <Clock className="size-4 text-amber-600" />
      </div>
      {d.label && (
        <div
          className="absolute left-1/2 text-[11px] font-medium text-foreground whitespace-nowrap pointer-events-none"
          style={{ top: 46, transform: "translateX(-50%)" }}
        >
          {d.label}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
    </div>
  );
});
TimerEventNode.displayName = "TimerEventNode";

// ==================== Message Event ====================

export const MessageEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div
        className="flex items-center justify-center rounded-full border-2 transition-shadow"
        style={{
          width: 40,
          height: 40,
          borderColor: selected ? "#3b82f6" : "#2563eb",
          background: selected ? "#dbeafe" : "#eff6ff",
          boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.3)" : "none",
        }}
      >
        <Mail className="size-4 text-blue-600" />
      </div>
      {d.label && (
        <div
          className="absolute left-1/2 text-[11px] font-medium text-foreground whitespace-nowrap pointer-events-none"
          style={{ top: 46, transform: "translateX(-50%)" }}
        >
          {d.label}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
    </div>
  );
});
MessageEventNode.displayName = "MessageEventNode";

// ==================== Task Base Component ====================

function TaskNodeBase({
  data,
  selected,
  color,
  bgColor,
  borderColor,
  Icon,
}: {
  data: BpmnNodeData;
  selected?: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
  Icon: React.ElementType;
}) {
  return (
    <div
      className="relative rounded-lg border-2 transition-shadow flex items-center gap-2 px-3 py-2"
      style={{
        minWidth: 120,
        minHeight: 52,
        borderColor: selected ? color : borderColor,
        background: selected ? bgColor : "#fff",
        boxShadow: selected ? `0 0 0 3px ${color}33` : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div
        className="flex items-center justify-center rounded size-7 shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon className="size-4" style={{ color }} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-foreground truncate">
          {data.label || "Task"}
        </span>
        {data.assignee && (
          <span className="text-[10px] text-muted-foreground truncate">
            {String(data.assignee)}
          </span>
        )}
        {data.delegateExpression && (
          <span className="text-[10px] text-muted-foreground truncate">
            {String(data.delegateExpression)}
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
    </div>
  );
}

// ==================== User Task ====================

export const UserTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#3b82f6"
    bgColor="#dbeafe"
    borderColor="#93c5fd"
    Icon={User}
  />
));
UserTaskNode.displayName = "UserTaskNode";

// ==================== Service Task ====================

export const ServiceTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#f97316"
    bgColor="#ffedd5"
    borderColor="#fdba74"
    Icon={Cog}
  />
));
ServiceTaskNode.displayName = "ServiceTaskNode";

// ==================== Script Task ====================

export const ScriptTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#8b5cf6"
    bgColor="#ede9fe"
    borderColor="#c4b5fd"
    Icon={Code}
  />
));
ScriptTaskNode.displayName = "ScriptTaskNode";

// ==================== Business Rule Task ====================

export const BusinessRuleTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#ec4899"
    bgColor="#fce7f3"
    borderColor="#f9a8d4"
    Icon={Layers}
  />
));
BusinessRuleTaskNode.displayName = "BusinessRuleTaskNode";

// ==================== Gateway Base Component ====================

function GatewayNodeBase({
  data,
  selected,
  color,
  bgColor,
  borderColor,
  Icon,
  iconContent,
}: {
  data: BpmnNodeData;
  selected?: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
  Icon?: React.ElementType;
  iconContent?: React.ReactNode;
}) {
  return (
    <div className="relative" style={{ width: 48, height: 48 }}>
      {/* Diamond shape */}
      <div
        className="flex items-center justify-center transition-shadow"
        style={{
          width: 48,
          height: 48,
          transform: "rotate(45deg)",
          border: `2px solid ${selected ? color : borderColor}`,
          background: selected ? bgColor : "#fff",
          borderRadius: 6,
          boxShadow: selected ? `0 0 0 3px ${color}33` : "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ transform: "rotate(-45deg)" }}>
          {iconContent || (Icon && <Icon className="size-4" style={{ color }} />)}
        </div>
      </div>
      {data.label && (
        <div
          className="absolute left-1/2 text-[11px] font-medium text-foreground whitespace-nowrap pointer-events-none"
          style={{ top: 54, transform: "translateX(-50%)" }}
        >
          {data.label}
        </div>
      )}
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
      <Handle type="target" position={Position.Top} id="top" style={{ ...targetHandleStyle, top: -4 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...sourceHandleStyle, bottom: -4 }} />
    </div>
  );
}

// ==================== Exclusive Gateway ====================

export const ExclusiveGatewayNode = memo(({ data, selected }: NodeProps) => (
  <GatewayNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#eab308"
    bgColor="#fef9c3"
    borderColor="#fde047"
    Icon={GitBranch}
  />
));
ExclusiveGatewayNode.displayName = "ExclusiveGatewayNode";

// ==================== Parallel Gateway ====================

export const ParallelGatewayNode = memo(({ data, selected }: NodeProps) => (
  <GatewayNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#22c55e"
    bgColor="#dcfce7"
    borderColor="#86efac"
    iconContent={<Plus className="size-4 text-green-600" />}
  />
));
ParallelGatewayNode.displayName = "ParallelGatewayNode";

// ==================== Inclusive Gateway ====================

export const InclusiveGatewayNode = memo(({ data, selected }: NodeProps) => (
  <GatewayNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#06b6d4"
    bgColor="#cffafe"
    borderColor="#67e8f9"
    iconContent={<Circle className="size-4 text-cyan-600" />}
  />
));
InclusiveGatewayNode.displayName = "InclusiveGatewayNode";

// ==================== Subprocess ====================

export const SubProcessNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div
      className="relative rounded-lg border-2 border-dashed transition-shadow px-4 py-3"
      style={{
        minWidth: 200,
        minHeight: 120,
        borderColor: selected ? "#6366f1" : "#a5b4fc",
        background: selected ? "#eef2ff" : "#f8fafc",
        boxShadow: selected ? "0 0 0 3px rgba(99,102,241,0.3)" : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Layers className="size-4 text-indigo-500" />
        <span className="text-xs font-semibold text-foreground">
          {d.label || "Subprocess"}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-[10px]">
        Drop elements here
      </div>
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
    </div>
  );
});
SubProcessNode.displayName = "SubProcessNode";

// ==================== Call Activity ====================

export const CallActivityNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    color="#6366f1"
    bgColor="#eef2ff"
    borderColor="#a5b4fc"
    Icon={Phone}
  />
));
CallActivityNode.displayName = "CallActivityNode";

// ---------- Node Type Registry ----------

export const bpmnNodeTypes = {
  startEvent: StartEventNode,
  endEvent: EndEventNode,
  timerEvent: TimerEventNode,
  messageEvent: MessageEventNode,
  userTask: UserTaskNode,
  serviceTask: ServiceTaskNode,
  scriptTask: ScriptTaskNode,
  businessRuleTask: BusinessRuleTaskNode,
  exclusiveGateway: ExclusiveGatewayNode,
  parallelGateway: ParallelGatewayNode,
  inclusiveGateway: InclusiveGatewayNode,
  subprocess: SubProcessNode,
  callActivity: CallActivityNode,
};

// ---------- Node Type Metadata (for palette) ----------

export interface BpmnNodeTypeMeta {
  type: string;
  label: string;
  category: string;
  color: string;
  bgColor: string;
  borderColor: string;
  Icon: React.ElementType;
  defaultData: Record<string, unknown>;
}

export const bpmnNodeTypeRegistry: BpmnNodeTypeMeta[] = [
  // Events
  { type: "startEvent", label: "Start Event", category: "Events", color: "#16a34a", bgColor: "#dcfce7", borderColor: "#86efac", Icon: Play, defaultData: { label: "Start" } },
  { type: "endEvent", label: "End Event", category: "Events", color: "#dc2626", bgColor: "#fee2e2", borderColor: "#fca5a5", Icon: Octagon, defaultData: { label: "End" } },
  { type: "timerEvent", label: "Timer Event", category: "Events", color: "#d97706", bgColor: "#fef3c7", borderColor: "#fcd34d", Icon: Clock, defaultData: { label: "Timer" } },
  { type: "messageEvent", label: "Message Event", category: "Events", color: "#2563eb", bgColor: "#dbeafe", borderColor: "#93c5fd", Icon: Mail, defaultData: { label: "Message" } },
  // Tasks
  { type: "userTask", label: "User Task", category: "Tasks", color: "#3b82f6", bgColor: "#dbeafe", borderColor: "#93c5fd", Icon: User, defaultData: { label: "User Task", assignee: "" } },
  { type: "serviceTask", label: "Service Task", category: "Tasks", color: "#f97316", bgColor: "#ffedd5", borderColor: "#fdba74", Icon: Cog, defaultData: { label: "Service Task", delegateExpression: "" } },
  { type: "scriptTask", label: "Script Task", category: "Tasks", color: "#8b5cf6", bgColor: "#ede9fe", borderColor: "#c4b5fd", Icon: Code, defaultData: { label: "Script Task", scriptFormat: "groovy", script: "" } },
  { type: "businessRuleTask", label: "Business Rule", category: "Tasks", color: "#ec4899", bgColor: "#fce7f3", borderColor: "#f9a8d4", Icon: Layers, defaultData: { label: "Business Rule" } },
  // Gateways
  { type: "exclusiveGateway", label: "Exclusive", category: "Gateways", color: "#eab308", bgColor: "#fef9c3", borderColor: "#fde047", Icon: GitBranch, defaultData: { label: "XOR" } },
  { type: "parallelGateway", label: "Parallel", category: "Gateways", color: "#22c55e", bgColor: "#dcfce7", borderColor: "#86efac", Icon: Plus, defaultData: { label: "AND" } },
  { type: "inclusiveGateway", label: "Inclusive", category: "Gateways", color: "#06b6d4", bgColor: "#cffafe", borderColor: "#67e8f9", Icon: Circle, defaultData: { label: "OR" } },
  // Subprocess
  { type: "subprocess", label: "Subprocess", category: "Subprocess", color: "#6366f1", bgColor: "#eef2ff", borderColor: "#a5b4fc", Icon: Layers, defaultData: { label: "Subprocess" } },
  { type: "callActivity", label: "Call Activity", category: "Subprocess", color: "#6366f1", bgColor: "#eef2ff", borderColor: "#a5b4fc", Icon: Phone, defaultData: { label: "Call Activity" } },
];
