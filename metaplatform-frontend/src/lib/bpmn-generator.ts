/**
 * BPMN 2.0 XML Generator
 * Generates valid BPMN 2.0 XML from React Flow node/edge data for Flowable deployment.
 */

// ---------- Types ----------

export interface BpmnNode {
  id: string;
  type: string; // startEvent, endEvent, userTask, serviceTask, scriptTask, exclusiveGateway, parallelGateway, inclusiveGateway, subprocess, callActivity, timerEvent, messageEvent
  name?: string;
  data?: Record<string, unknown>;
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

export interface BpmnEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
  data?: Record<string, unknown>;
}

export interface BpmnProcess {
  id: string;
  name: string;
  nodes: BpmnNode[];
  edges: BpmnEdge[];
}

// ---------- Constants ----------

const NODE_SIZES: Record<string, { w: number; h: number }> = {
  startEvent: { w: 36, h: 36 },
  endEvent: { w: 36, h: 36 },
  timerEvent: { w: 36, h: 36 },
  messageEvent: { w: 36, h: 36 },
  userTask: { w: 100, h: 80 },
  serviceTask: { w: 100, h: 80 },
  scriptTask: { w: 100, h: 80 },
  businessRuleTask: { w: 100, h: 80 },
  exclusiveGateway: { w: 50, h: 50 },
  parallelGateway: { w: 50, h: 50 },
  inclusiveGateway: { w: 50, h: 50 },
  subprocess: { w: 300, h: 200 },
  callActivity: { w: 100, h: 80 },
};

const BPMN_ELEMENT_MAP: Record<string, string> = {
  startEvent: "bpmn:startEvent",
  endEvent: "bpmn:endEvent",
  timerEvent: "bpmn:startEvent",
  messageEvent: "bpmn:startEvent",
  userTask: "bpmn:userTask",
  serviceTask: "bpmn:serviceTask",
  scriptTask: "bpmn:scriptTask",
  businessRuleTask: "bpmn:businessRuleTask",
  exclusiveGateway: "bpmn:exclusiveGateway",
  parallelGateway: "bpmn:parallelGateway",
  inclusiveGateway: "bpmn:inclusiveGateway",
  subprocess: "bpmn:subProcess",
  callActivity: "bpmn:callActivity",
};

// ---------- XML Escape ----------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- Attribute Builder ----------

function attrs(obj: Record<string, string | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}="${esc(v!)}"`)
    .join(" ");
}

// ---------- Main Generator ----------

export function generateBpmnXml(process: BpmnProcess): string {
  const pid = process.id || "Process_1";
  const pname = process.name || "Unnamed Process";

  // Build process elements
  const elements: string[] = [];
  const flows: string[] = [];
  const shapes: string[] = [];
  const bpmnEdges: string[] = [];

  // Determine default flow for exclusive gateways
  const gatewayOutgoing = new Map<string, string[]>();
  for (const edge of process.edges) {
    const existing = gatewayOutgoing.get(edge.source) || [];
    existing.push(edge.id);
    gatewayOutgoing.set(edge.source, existing);
  }

  for (const node of process.nodes) {
    const tag = BPMN_ELEMENT_MAP[node.type];
    if (!tag) continue;

    const size = NODE_SIZES[node.type] || { w: 100, h: 80 };
    const w = node.width ?? size.w;
    const h = node.height ?? size.h;

    const incomingEdges = process.edges.filter((e) => e.target === node.id);
    const outgoingEdges = process.edges.filter((e) => e.source === node.id);
    const incoming = incomingEdges.map((e) => e.id);
    const outgoing = outgoingEdges.map((e) => e.id);

    const baseAttrs: Record<string, string> = { id: node.id };
    if (node.name) baseAttrs.name = node.name;

    // Build element body
    let body = "";

    // Event definitions for timer/message events
    if (node.type === "timerEvent") {
      body += `\n        <bpmn:timerEventDefinition id="TimerDef_${node.id}" />`;
    } else if (node.type === "messageEvent") {
      body += `\n        <bpmn:messageEventDefinition id="MessageDef_${node.id}" />`;
    }

    // Default flow for exclusive/inclusive gateways
    if (node.type === "exclusiveGateway" || node.type === "inclusiveGateway") {
      const outIds = gatewayOutgoing.get(node.id) || [];
      if (outIds.length > 0) {
        // The first conditionless outgoing edge is default; otherwise first edge
        const defaultEdge = outgoingEdges.find((e) => !e.condition) || outgoingEdges[0];
        if (defaultEdge) {
          baseAttrs.default = defaultEdge.id;
        }
      }
    }

    // Task-specific attributes
    const data = node.data || {};
    if (node.type === "userTask") {
      if (data.assignee) baseAttrs["flowable:assignee"] = String(data.assignee);
      if (data.candidateGroups) baseAttrs["flowable:candidateGroups"] = String(data.candidateGroups);
      if (data.dueDate) baseAttrs["flowable:dueDate"] = String(data.dueDate);
      if (data.priority) baseAttrs["flowable:priority"] = String(data.priority);
    } else if (node.type === "serviceTask") {
      if (data.delegateExpression) baseAttrs["flowable:delegateExpression"] = String(data.delegateExpression);
      if (data.class) baseAttrs["flowable:class"] = String(data.class);
    } else if (node.type === "scriptTask") {
      if (data.scriptFormat) baseAttrs.scriptFormat = String(data.scriptFormat);
      if (data.script) {
        body += `\n        <bpmn:script>${esc(String(data.script))}</bpmn:script>`;
      }
    }

    // Incoming / outgoing references
    for (const ref of incoming) {
      body += `\n        <bpmn:incoming>${ref}</bpmn:incoming>`;
    }
    for (const ref of outgoing) {
      body += `\n        <bpmn:outgoing>${ref}</bpmn:outgoing>`;
    }

    const attrStr = attrs(baseAttrs);
    if (body) {
      elements.push(`    <${tag} ${attrStr}>${body}\n    </${tag}>`);
    } else {
      elements.push(`    <${tag} ${attrStr} />`);
    }

    // DI shape
    const cx = node.position.x + w / 2;
    const cy = node.position.y + h / 2;
    shapes.push(
      `      <bpmndi:BPMNShape id="Shape_${node.id}" bpmnElement="${node.id}">` +
        `\n        <dc:Bounds x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" />` +
        (node.name
          ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${cx - 40}" y="${cy + h / 2 + 5}" width="80" height="14" /></bpmndi:BPMNLabel>`
          : "") +
        `\n      </bpmndi:BPMNShape>`
    );
  }

  // Sequence flows
  for (const edge of process.edges) {
    const flowAttrs: Record<string, string> = {
      id: edge.id,
      sourceRef: edge.source,
      targetRef: edge.target,
    };
    if (edge.label) flowAttrs.name = edge.label;

    let flowBody = "";
    if (edge.condition) {
      flowBody = `\n      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${esc(edge.condition)}</bpmn:conditionExpression>\n    `;
    }

    if (flowBody) {
      flows.push(`    <bpmn:sequenceFlow ${attrs(flowAttrs)}>${flowBody}</bpmn:sequenceFlow>`);
    } else {
      flows.push(`    <bpmn:sequenceFlow ${attrs(flowAttrs)} />`);
    }

    // DI edge with waypoints
    const sourceNode = process.nodes.find((n) => n.id === edge.source);
    const targetNode = process.nodes.find((n) => n.id === edge.target);
    if (sourceNode && targetNode) {
      const sSize = NODE_SIZES[sourceNode.type] || { w: 100, h: 80 };
      const tSize = NODE_SIZES[targetNode.type] || { w: 100, h: 80 };
      const sw = sourceNode.width ?? sSize.w;
      const sh = sourceNode.height ?? sSize.h;
      const tw = targetNode.width ?? tSize.w;
      const th = targetNode.height ?? tSize.h;

      // Calculate exit point (right center) and entry point (left center)
      const sx = sourceNode.position.x + sw;
      const sy = sourceNode.position.y + sh / 2;
      const tx = targetNode.position.x;
      const ty = targetNode.position.y + th / 2;

      bpmnEdges.push(
        `      <bpmndi:BPMNEdge id="Edge_${edge.id}" bpmnElement="${edge.id}">` +
          `\n        <di:waypoint x="${sx}" y="${sy}" />` +
          `\n        <di:waypoint x="${tx}" y="${ty}" />` +
          (edge.label
            ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${(sx + tx) / 2 - 20}" y="${(sy + ty) / 2 - 7}" width="40" height="14" /></bpmndi:BPMNLabel>`
            : "") +
          `\n      </bpmndi:BPMNEdge>`
      );
    }
  }

  // Assemble XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:flowable="http://flowable.org/bpmn"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="MetaPlatform BPMN Designer"
  exporterVersion="2.0">

  <bpmn:process id="${esc(pid)}" name="${esc(pname)}" isExecutable="true">
${elements.join("\n")}
${flows.join("\n")}
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${esc(pid)}">
${shapes.join("\n")}
${bpmnEdges.join("\n")}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

  return xml;
}

// ---------- XML Parser (Import) ----------

export interface ParsedBpmnProcess {
  id: string;
  name: string;
  nodes: BpmnNode[];
  edges: BpmnEdge[];
}

const TAG_TO_TYPE: Record<string, string> = {
  "bpmn:startEvent": "startEvent",
  "bpmn:endEvent": "endEvent",
  "bpmn:userTask": "userTask",
  "bpmn:serviceTask": "serviceTask",
  "bpmn:scriptTask": "scriptTask",
  "bpmn:businessRuleTask": "businessRuleTask",
  "bpmn:exclusiveGateway": "exclusiveGateway",
  "bpmn:parallelGateway": "parallelGateway",
  "bpmn:inclusiveGateway": "inclusiveGateway",
  "bpmn:subProcess": "subprocess",
  "bpmn:callActivity": "callActivity",
};

export function parseBpmnXml(xmlString: string): ParsedBpmnProcess | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    const processEl = doc.querySelector("process");
    if (!processEl) return null;

    const processId = processEl.getAttribute("id") || "Process_1";
    const processName = processEl.getAttribute("name") || "Unnamed";

    const nodes: BpmnNode[] = [];
    const edges: BpmnEdge[] = [];

    // Parse shapes from DI for position lookup
    const shapeMap = new Map<string, { x: number; y: number; w: number; h: number }>();
    doc.querySelectorAll("BPMNShape").forEach((shape) => {
      const bpmnEl = shape.getAttribute("bpmnElement");
      const bounds = shape.querySelector("Bounds");
      if (bpmnEl && bounds) {
        shapeMap.set(bpmnEl, {
          x: parseFloat(bounds.getAttribute("x") || "0"),
          y: parseFloat(bounds.getAttribute("y") || "0"),
          w: parseFloat(bounds.getAttribute("width") || "100"),
          h: parseFloat(bounds.getAttribute("height") || "80"),
        });
      }
    });

    // Parse elements
    for (const [tag, type] of Object.entries(TAG_TO_TYPE)) {
      const localName = tag.split(":")[1];
      processEl.querySelectorAll(localName).forEach((el) => {
        const id = el.getAttribute("id") || "";
        const name = el.getAttribute("name") || undefined;
        const pos = shapeMap.get(id);
        const data: Record<string, unknown> = {};

        // Extract Flowable-specific attributes
        const assignee = el.getAttribute("flowable:assignee");
        const candidateGroups = el.getAttribute("flowable:candidateGroups");
        const delegateExpression = el.getAttribute("flowable:delegateExpression");
        const clazz = el.getAttribute("flowable:class");
        if (assignee) data.assignee = assignee;
        if (candidateGroups) data.candidateGroups = candidateGroups;
        if (delegateExpression) data.delegateExpression = delegateExpression;
        if (clazz) data.class = clazz;

        // Script task
        const scriptEl = el.querySelector("script");
        if (scriptEl) data.script = scriptEl.textContent || "";
        const scriptFormat = el.getAttribute("scriptFormat");
        if (scriptFormat) data.scriptFormat = scriptFormat;

        // Timer/Message event detection
        let nodeType = type;
        if (type === "startEvent") {
          if (el.querySelector("timerEventDefinition")) nodeType = "timerEvent";
          else if (el.querySelector("messageEventDefinition")) nodeType = "messageEvent";
        }

        nodes.push({
          id,
          type: nodeType,
          name,
          data,
          position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
          width: pos?.w,
          height: pos?.h,
        });
      });
    }

    // Parse sequence flows
    processEl.querySelectorAll("sequenceFlow").forEach((flow) => {
      const id = flow.getAttribute("id") || "";
      const source = flow.getAttribute("sourceRef") || "";
      const target = flow.getAttribute("targetRef") || "";
      const name = flow.getAttribute("name") || undefined;
      const condEl = flow.querySelector("conditionExpression");
      const condition = condEl?.textContent || undefined;

      edges.push({ id, source, target, label: name, condition });
    });

    return { id: processId, name: processName, nodes, edges };
  } catch {
    return null;
  }
}
