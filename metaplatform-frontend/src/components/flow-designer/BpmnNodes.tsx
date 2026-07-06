/**
 * Custom React Flow node components for BPMN 2.0 elements.
 *
 * "Systematic Rhythm" design — clinical, minimal, unified.
 *
 * Color system (4 semantic + neutral):
 *   Start:    #22c55e (green)
 *   End:      #ef4444 (red)
 *   Neutral:  #94a3b8 (icon, handle, lines)
 *   Border:   #d6d4d0 (node), #d1d5db (dashed)
 *   Bg:       #fff (events/tasks), #f0efed (gateways)
 *
 * All tasks/gateways use identical neutral styling — differentiated by icon only.
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
  Sparkles,
  Zap,
  Group,
  MessageSquareText,
} from "lucide-react";

// ==================== Design Tokens ====================

const C = {
  // Semantic
  start: "#22c55e",
  end: "#ef4444",
  // Neutral
  icon: "#94a3b8",
  border: "#d6d4d0",
  borderLight: "#e2e0dc",
  dashedBorder: "#d1d5db",
  // Backgrounds
  white: "#fff",
  node: "#f8f7f5",
  gateway: "#f0efed",
  annotationBg: "#f8fafc",
} as const;

// Selected state — subtle border change, no shadow
const SELECTED_BORDER = "#94a3b8";

// ==================== Shared Handle Styles ====================

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  border: "2px solid #fff",
  background: C.icon,
};

const sourceHandleStyle: React.CSSProperties = { ...handleStyle };
const targetHandleStyle: React.CSSProperties = { ...handleStyle };

// ==================== Shared Types ====================

interface BpmnNodeData {
  label?: string;
  [key: string]: unknown;
}

// ==================== Event Nodes (circle 40×40) ====================

// --- Start Event ---
// White bg, green border (2px), green play triangle. No shadow.

export const StartEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          border: `2px solid ${selected ? SELECTED_BORDER : C.start}`,
          background: C.white,
          transition: "border-color 0.15s",
        }}
      >
        <Play className="size-4" style={{ color: C.start }} />
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

// --- End Event ---
// White bg, red border (3px — thicker than start), solid red dot inside.

export const EndEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          border: `3px solid ${selected ? SELECTED_BORDER : C.end}`,
          background: C.white,
          transition: "border-color 0.15s",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: selected ? SELECTED_BORDER : C.end,
            transition: "background 0.15s",
          }}
        />
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

// --- Timer Event ---
// White bg, neutral border, clock icon.

export const TimerEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          border: `2px solid ${selected ? SELECTED_BORDER : C.border}`,
          background: C.white,
          transition: "border-color 0.15s",
        }}
      >
        <Clock className="size-4" style={{ color: C.icon }} />
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

// --- Message Event ---
// White bg, neutral border, mail icon.

export const MessageEventNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div className="relative" style={{ width: 40, height: 40 }}>
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          border: `2px solid ${selected ? SELECTED_BORDER : C.border}`,
          background: C.white,
          transition: "border-color 0.15s",
        }}
      >
        <Mail className="size-4" style={{ color: C.icon }} />
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

// ==================== Task Nodes (rounded rectangle) ====================

/**
 * Unified task node — matches canvas design exactly:
 * - White/off-white bg (#f8f7f5), gray border (#d6d4d0)
 * - Gray icon badge (circle #f3f1ee bg, #d6d4d0 border, #94a3b8 icon)
 * - No shadows, no colored accents
 * - Differentiated solely by icon
 */
function TaskNodeBase({
  data,
  selected,
  Icon,
}: {
  data: BpmnNodeData;
  selected?: boolean;
  Icon: React.ElementType;
}) {
  return (
    <div
      className="relative flex items-center gap-2 px-3 py-2"
      style={{
        minWidth: 120,
        minHeight: 52,
        borderRadius: 8,
        border: `1.2px solid ${selected ? SELECTED_BORDER : C.border}`,
        background: C.node,
        transition: "border-color 0.15s",
      }}
    >
      {/* Icon badge — gray circle with icon */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#f3f1ee",
          border: `0.8px solid ${C.border}`,
        }}
      >
        <Icon className="size-3.5" style={{ color: C.icon }} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium text-foreground truncate">
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

export const UserTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase data={data as BpmnNodeData} selected={selected} Icon={User} />
));
UserTaskNode.displayName = "UserTaskNode";

export const ServiceTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase data={data as BpmnNodeData} selected={selected} Icon={Cog} />
));
ServiceTaskNode.displayName = "ServiceTaskNode";

export const ScriptTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase data={data as BpmnNodeData} selected={selected} Icon={Code} />
));
ScriptTaskNode.displayName = "ScriptTaskNode";

export const BusinessRuleTaskNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase data={data as BpmnNodeData} selected={selected} Icon={Layers} />
));
BusinessRuleTaskNode.displayName = "BusinessRuleTaskNode";

export const CallActivityNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase data={data as BpmnNodeData} selected={selected} Icon={Phone} />
));
CallActivityNode.displayName = "CallActivityNode";

export const AIDecisionNode = memo(({ data, selected }: NodeProps) => (
  <TaskNodeBase data={data as BpmnNodeData} selected={selected} Icon={Sparkles} />
));
AIDecisionNode.displayName = "AIDecisionNode";

// ==================== Gateway Nodes (diamond 48×48) ====================

/**
 * Unified gateway node — matches canvas design exactly:
 * - White/off-white bg (#f0efed), gray border (#d6d4d0)
 * - Gray icon (X, +, circle)
 * - No shadows, no colored accents
 * - Differentiated solely by icon
 */
function GatewayNodeBase({
  data,
  selected,
  Icon,
  iconContent,
}: {
  data: BpmnNodeData;
  selected?: boolean;
  Icon?: React.ElementType;
  iconContent?: React.ReactNode;
}) {
  return (
    <div className="relative" style={{ width: 48, height: 48 }}>
      {/* Diamond shape */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 48,
          height: 48,
          transform: "rotate(45deg)",
          border: `1.2px solid ${selected ? SELECTED_BORDER : C.border}`,
          background: C.gateway,
          borderRadius: 6,
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ transform: "rotate(-45deg)" }}>
          {iconContent || (Icon && <Icon className="size-4" style={{ color: C.icon }} />)}
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

export const ExclusiveGatewayNode = memo(({ data, selected }: NodeProps) => (
  <GatewayNodeBase data={data as BpmnNodeData} selected={selected} Icon={GitBranch} />
));
ExclusiveGatewayNode.displayName = "ExclusiveGatewayNode";

export const ParallelGatewayNode = memo(({ data, selected }: NodeProps) => (
  <GatewayNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    iconContent={<Plus className="size-4" style={{ color: C.icon }} />}
  />
));
ParallelGatewayNode.displayName = "ParallelGatewayNode";

export const InclusiveGatewayNode = memo(({ data, selected }: NodeProps) => (
  <GatewayNodeBase
    data={data as BpmnNodeData}
    selected={selected}
    iconContent={<Circle className="size-4" style={{ color: C.icon }} />}
  />
));
InclusiveGatewayNode.displayName = "InclusiveGatewayNode";

export const EventGatewayNode = memo(({ data, selected }: NodeProps) => (
  <GatewayNodeBase data={data as BpmnNodeData} selected={selected} Icon={Zap} />
));
EventGatewayNode.displayName = "EventGatewayNode";

// ==================== Container Nodes ====================

export const SubProcessNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div
      className="relative px-4 py-3"
      style={{
        minWidth: 200,
        minHeight: 120,
        borderRadius: 8,
        border: `1.2px dashed ${selected ? SELECTED_BORDER : C.dashedBorder}`,
        background: C.white,
        transition: "border-color 0.15s",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Layers className="size-4" style={{ color: C.icon }} />
        <span className="text-xs font-medium text-foreground">
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

export const GroupNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div
      className="relative px-4 py-3"
      style={{
        minWidth: 180,
        minHeight: 100,
        borderRadius: 8,
        border: `1.2px dashed ${selected ? SELECTED_BORDER : C.dashedBorder}`,
        background: C.white,
        transition: "border-color 0.15s",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Group className="size-4" style={{ color: C.icon }} />
        <span className="text-xs font-medium text-foreground">
          {d.label || "Group"}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-[10px]">
        Group elements
      </div>
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
    </div>
  );
});
GroupNode.displayName = "GroupNode";

export const EventSubprocessNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div
      className="relative px-4 py-3"
      style={{
        minWidth: 200,
        minHeight: 100,
        borderRadius: 8,
        border: `1.2px dashed ${selected ? SELECTED_BORDER : C.dashedBorder}`,
        background: C.white,
        transition: "border-color 0.15s",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Zap className="size-4" style={{ color: C.icon }} />
        <span className="text-xs font-medium text-foreground">
          {d.label || "Event Subprocess"}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-[10px]">
        Event-driven subprocess
      </div>
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
    </div>
  );
});
EventSubprocessNode.displayName = "EventSubprocessNode";

// ==================== Annotation Nodes ====================

export const TextAnnotationNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div
      className="relative px-3 py-2"
      style={{
        minWidth: 140,
        minHeight: 48,
        borderLeft: `2px solid ${selected ? SELECTED_BORDER : C.icon}`,
        borderRadius: 4,
        background: C.annotationBg,
        transition: "border-color 0.15s",
      }}
    >
      <div className="flex items-center gap-2">
        <MessageSquareText className="size-3.5 shrink-0" style={{ color: C.icon }} />
        <span className="text-xs text-foreground">
          {d.label || "Text Annotation"}
        </span>
      </div>
    </div>
  );
});
TextAnnotationNode.displayName = "TextAnnotationNode";

// ==================== Approval Node ====================

/**
 * Approval node — special task for review/approval workflows.
 * Same visual as TaskNodeBase but with a distinct icon (Shield).
 * Uses gray/neutral style matching the design system.
 */
export const ApprovalNode = memo(({ data, selected }: NodeProps) => {
  const d = data as BpmnNodeData;
  return (
    <div
      className="relative flex items-center gap-2 px-3 py-2"
      style={{
        minWidth: 120,
        minHeight: 52,
        borderRadius: 8,
        border: `1.2px solid ${selected ? SELECTED_BORDER : C.border}`,
        background: C.node,
        transition: "border-color 0.15s",
      }}
    >
      {/* Shield icon badge */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#f3f1ee",
          border: `0.8px solid ${C.border}`,
        }}
      >
        <svg className="size-3.5" style={{ color: C.icon }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium text-foreground truncate">
          {d.label || "Approval"}
        </span>
        {d.approvalType && (
          <span className="text-[10px] text-muted-foreground truncate">
            {String(d.approvalType)}
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={targetHandleStyle} />
      <Handle type="source" position={Position.Right} style={sourceHandleStyle} />
    </div>
  );
});
ApprovalNode.displayName = "ApprovalNode";

// ==================== Node Type Registry ====================

export const bpmnNodeTypes = {
  startEvent: StartEventNode,
  endEvent: EndEventNode,
  timerEvent: TimerEventNode,
  messageEvent: MessageEventNode,
  userTask: UserTaskNode,
  serviceTask: ServiceTaskNode,
  scriptTask: ScriptTaskNode,
  businessRuleTask: BusinessRuleTaskNode,
  approvalTask: ApprovalNode,
  exclusiveGateway: ExclusiveGatewayNode,
  parallelGateway: ParallelGatewayNode,
  inclusiveGateway: InclusiveGatewayNode,
  subprocess: SubProcessNode,
  callActivity: CallActivityNode,
  group: GroupNode,
  textAnnotation: TextAnnotationNode,
  aiDecision: AIDecisionNode,
  eventSubprocess: EventSubprocessNode,
  eventGateway: EventGatewayNode,
};

// ==================== Node Type Metadata (for palette) ====================

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
  { type: "startEvent", label: "Start Event", category: "Events", color: C.start, bgColor: C.white, borderColor: C.start, Icon: Play, defaultData: { label: "Start" } },
  { type: "endEvent", label: "End Event", category: "Events", color: C.end, bgColor: C.white, borderColor: C.end, Icon: Octagon, defaultData: { label: "End" } },
  { type: "timerEvent", label: "Timer Event", category: "Events", color: C.icon, bgColor: C.white, borderColor: C.border, Icon: Clock, defaultData: { label: "Timer" } },
  { type: "messageEvent", label: "Message Event", category: "Events", color: C.icon, bgColor: C.white, borderColor: C.border, Icon: Mail, defaultData: { label: "Message" } },
  // Tasks — all neutral
  { type: "userTask", label: "User Task", category: "Tasks", color: C.icon, bgColor: C.node, borderColor: C.border, Icon: User, defaultData: { label: "User Task", assignee: "" } },
  { type: "serviceTask", label: "Service Task", category: "Tasks", color: C.icon, bgColor: C.node, borderColor: C.border, Icon: Cog, defaultData: { label: "Service Task", delegateExpression: "" } },
  { type: "scriptTask", label: "Script Task", category: "Tasks", color: C.icon, bgColor: C.node, borderColor: C.border, Icon: Code, defaultData: { label: "Script Task", scriptFormat: "groovy", script: "" } },
  { type: "businessRuleTask", label: "Business Rule", category: "Tasks", color: C.icon, bgColor: C.node, borderColor: C.border, Icon: Layers, defaultData: { label: "Business Rule" } },
  { type: "approvalTask", label: "Approval", category: "Tasks", color: C.icon, bgColor: C.node, borderColor: C.border, Icon: Layers, defaultData: { label: "Approval", approvalType: "or" } },
  { type: "aiDecision", label: "AI Decision", category: "Tasks", color: C.icon, bgColor: C.node, borderColor: C.border, Icon: Sparkles, defaultData: { label: "AI Decision" } },
  // Gateways — all neutral
  { type: "exclusiveGateway", label: "Exclusive", category: "Gateways", color: C.icon, bgColor: C.gateway, borderColor: C.border, Icon: GitBranch, defaultData: { label: "XOR" } },
  { type: "parallelGateway", label: "Parallel", category: "Gateways", color: C.icon, bgColor: C.gateway, borderColor: C.border, Icon: Plus, defaultData: { label: "AND" } },
  { type: "inclusiveGateway", label: "Inclusive", category: "Gateways", color: C.icon, bgColor: C.gateway, borderColor: C.border, Icon: Circle, defaultData: { label: "OR" } },
  { type: "eventGateway", label: "Event Gateway", category: "Gateways", color: C.icon, bgColor: C.gateway, borderColor: C.border, Icon: Zap, defaultData: { label: "Event" } },
  // Subprocess
  { type: "subprocess", label: "Subprocess", category: "Subprocess", color: C.icon, bgColor: C.white, borderColor: C.dashedBorder, Icon: Layers, defaultData: { label: "Subprocess" } },
  { type: "callActivity", label: "Call Activity", category: "Subprocess", color: C.icon, bgColor: C.node, borderColor: C.border, Icon: Phone, defaultData: { label: "Call Activity" } },
  { type: "eventSubprocess", label: "Event Subprocess", category: "Subprocess", color: C.icon, bgColor: C.white, borderColor: C.dashedBorder, Icon: Zap, defaultData: { label: "Event Subprocess" } },
  // Artifacts
  { type: "group", label: "Group", category: "Artifacts", color: C.icon, bgColor: C.white, borderColor: C.dashedBorder, Icon: Group, defaultData: { label: "Group" } },
  { type: "textAnnotation", label: "Text Annotation", category: "Artifacts", color: C.icon, bgColor: C.annotationBg, borderColor: C.icon, Icon: MessageSquareText, defaultData: { label: "Annotation" } },
];
