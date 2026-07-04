/**
 * PropertiesPanel - Right sidebar for editing node and edge properties.
 * Shows different fields based on the selected element type.
 */
import { useCallback, useEffect, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Trash2, X } from "lucide-react";
import { bpmnNodeTypeRegistry } from "./BpmnNodes";

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
  // Local form state
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Sync form data when selection changes
  useEffect(() => {
    if (selectedNode) {
      const data = selectedNode.data as Record<string, unknown>;
      const form: Record<string, string> = {
        label: String(data.label || ""),
      };
      if (selectedNode.type === "userTask") {
        form.assignee = String(data.assignee || "");
        form.candidateGroups = String(data.candidateGroups || "");
        form.dueDate = String(data.dueDate || "");
        form.priority = String(data.priority || "");
        form.description = String(data.description || "");
      } else if (selectedNode.type === "serviceTask") {
        form.delegateExpression = String(data.delegateExpression || "");
        form.javaAdapter = String(data.javaAdapter || "");
        form.description = String(data.description || "");
      } else if (selectedNode.type === "scriptTask") {
        form.scriptFormat = String(data.scriptFormat || "groovy");
        form.script = String(data.script || "");
      } else if (selectedNode.type === "businessRuleTask") {
        form.description = String(data.description || "");
      } else if (
        selectedNode.type === "exclusiveGateway" ||
        selectedNode.type === "parallelGateway" ||
        selectedNode.type === "inclusiveGateway"
      ) {
        form.defaultFlow = String(data.defaultFlow || "");
      }
      setFormData(form);
    } else if (selectedEdge) {
      setFormData({
        label: String(selectedEdge.label || ""),
        condition: String(selectedEdge.data?.condition || ""),
      });
    }
  }, [selectedNode, selectedEdge]);

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSave = useCallback(() => {
    if (selectedNode) {
      const data: Record<string, unknown> = { label: formData.label };
      if (selectedNode.type === "userTask") {
        data.assignee = formData.assignee || undefined;
        data.candidateGroups = formData.candidateGroups || undefined;
        data.dueDate = formData.dueDate || undefined;
        data.priority = formData.priority || undefined;
        data.description = formData.description || undefined;
      } else if (selectedNode.type === "serviceTask") {
        data.delegateExpression = formData.delegateExpression || undefined;
        data.javaAdapter = formData.javaAdapter || undefined;
        data.description = formData.description || undefined;
      } else if (selectedNode.type === "scriptTask") {
        data.scriptFormat = formData.scriptFormat || "groovy";
        data.script = formData.script || "";
      } else if (selectedNode.type === "businessRuleTask") {
        data.description = formData.description || undefined;
      } else if (
        selectedNode.type === "exclusiveGateway" ||
        selectedNode.type === "parallelGateway" ||
        selectedNode.type === "inclusiveGateway"
      ) {
        data.defaultFlow = formData.defaultFlow || undefined;
      }
      onUpdateNode(selectedNode.id, data);
    } else if (selectedEdge) {
      onUpdateEdge(selectedEdge.id, {
        label: formData.label,
        condition: formData.condition || undefined,
      });
    }
  }, [selectedNode, selectedEdge, formData, onUpdateNode, onUpdateEdge]);

  const meta = selectedNode
    ? bpmnNodeTypeRegistry.find((m) => m.type === selectedNode.type)
    : null;

  // ---- No selection: show process config ----
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b">
          <h3 className="text-sm font-semibold text-foreground">Process Properties</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Process ID</Label>
            <Input
              value={processConfig.id}
              onChange={(e) => onUpdateProcess({ ...processConfig, id: e.target.value })}
              className="h-8 text-xs"
              placeholder="myProcess"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Process Name</Label>
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

  // ---- Edge selected ----
  if (selectedEdge) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Sequence Flow</h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => onDeleteEdge(selectedEdge.id)}
            >
              <Trash2 className="size-3 text-destructive" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={onDeselect}>
              <X className="size-3" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={formData.label || ""}
              onChange={(e) => handleFieldChange("label", e.target.value)}
              className="h-8 text-xs"
              placeholder="Flow label"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Condition Expression</Label>
            <Textarea
              value={formData.condition || ""}
              onChange={(e) => handleFieldChange("condition", e.target.value)}
              className="text-xs min-h-[60px] font-mono"
              placeholder='${amount > 10000}'
            />
            <p className="text-[10px] text-muted-foreground">
              Use Flowable/JUEL expressions, e.g. ${"${variable == 'value'}"}
            </p>
          </div>
          <Button size="sm" className="w-full" onClick={handleSave}>
            Apply
          </Button>
        </div>
      </div>
    );
  }

  // ---- Node selected ----
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {meta && (
            <div
              className="flex items-center justify-center rounded size-5 shrink-0"
              style={{ background: `${meta.color}18` }}
            >
              <meta.Icon className="size-3" style={{ color: meta.color }} />
            </div>
          )}
          <h3 className="text-sm font-semibold text-foreground truncate">
            {meta?.label || selectedNode.type}
          </h3>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onDeleteNode(selectedNode.id)}
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6" onClick={onDeselect}>
            <X className="size-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Common: Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input
            value={formData.label || ""}
            onChange={(e) => handleFieldChange("label", e.target.value)}
            className="h-8 text-xs"
            placeholder="Element name"
          />
        </div>

        {/* Node ID (read-only) */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ID</Label>
          <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
            {selectedNode.id}
          </div>
        </div>

        {/* User Task fields */}
        {selectedNode.type === "userTask" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Assignee</Label>
              <Input
                value={formData.assignee || ""}
                onChange={(e) => handleFieldChange("assignee", e.target.value)}
                className="h-8 text-xs"
                placeholder="user001 or ${initiator}"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Candidate Groups</Label>
              <Input
                value={formData.candidateGroups || ""}
                onChange={(e) => handleFieldChange("candidateGroups", e.target.value)}
                className="h-8 text-xs"
                placeholder="managers,finance"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input
                value={formData.dueDate || ""}
                onChange={(e) => handleFieldChange("dueDate", e.target.value)}
                className="h-8 text-xs"
                placeholder="P3D or ${dueDate}"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Input
                value={formData.priority || ""}
                onChange={(e) => handleFieldChange("priority", e.target.value)}
                className="h-8 text-xs"
                placeholder="50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                className="text-xs min-h-[60px]"
                placeholder="Task description"
              />
            </div>
          </>
        )}

        {/* Service Task fields */}
        {selectedNode.type === "serviceTask" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Delegate Expression</Label>
              <Input
                value={formData.delegateExpression || ""}
                onChange={(e) => handleFieldChange("delegateExpression", e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="${myServiceDelegateBean}"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Java 适配器</Label>
              <Select
                value={formData.javaAdapter || ""}
                onValueChange={(val) => handleFieldChange("javaAdapter", val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择 Java 适配器（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不使用适配器</SelectItem>
                  <SelectItem value="com.metaplatform.adapter.HttpAdapter">HttpAdapter - HTTP 请求</SelectItem>
                  <SelectItem value="com.metaplatform.adapter.DbAdapter">DbAdapter - 数据库操作</SelectItem>
                  <SelectItem value="com.metaplatform.adapter.MqAdapter">MqAdapter - 消息队列</SelectItem>
                  <SelectItem value="com.metaplatform.adapter.RestAdapter">RestAdapter - REST API</SelectItem>
                  <SelectItem value="com.metaplatform.adapter.JavaDelegate">JavaDelegate - 自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                className="text-xs min-h-[60px]"
                placeholder="Service description"
              />
            </div>
          </>
        )}

        {/* Script Task fields */}
        {selectedNode.type === "scriptTask" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Script Format</Label>
              <Input
                value={formData.scriptFormat || "groovy"}
                onChange={(e) => handleFieldChange("scriptFormat", e.target.value)}
                className="h-8 text-xs"
                placeholder="groovy"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Script</Label>
              <Textarea
                value={formData.script || ""}
                onChange={(e) => handleFieldChange("script", e.target.value)}
                className="text-xs min-h-[120px] font-mono"
                placeholder="execution.setVariable('result', 'ok')"
              />
            </div>
          </>
        )}

        {/* Gateway fields */}
        {(selectedNode.type === "exclusiveGateway" ||
          selectedNode.type === "parallelGateway" ||
          selectedNode.type === "inclusiveGateway") && (
          <div className="space-y-1.5">
            <Label className="text-xs">Default Flow</Label>
            <Input
              value={formData.defaultFlow || ""}
              onChange={(e) => handleFieldChange("defaultFlow", e.target.value)}
              className="h-8 text-xs"
              placeholder="SequenceFlow_ID"
            />
          </div>
        )}

        {/* Business Rule Task fields */}
        {selectedNode.type === "businessRuleTask" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              className="text-xs min-h-[60px]"
              placeholder="Business rule description"
            />
          </div>
        )}

        <Button size="sm" className="w-full" onClick={handleSave}>
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
