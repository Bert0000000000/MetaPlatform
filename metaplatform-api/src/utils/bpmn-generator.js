/**
 * BPMN 2.0 XML Generator
 * Converts a JSON process definition into valid BPMN 2.0 XML with DI (Diagram Interchange).
 */

const BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";
const BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI";
const DC_NS = "http://www.omg.org/spec/DD/20100524/DC";
const DI_NS = "http://www.omg.org/spec/DD/20100524/DI";

// ─── XML Escaping ─────────────────────────────────────────
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Element builders ─────────────────────────────────────

function buildStartEvent(node) {
  return `    <startEvent id="${esc(node.id)}" name="${esc(node.name || "")}" />`;
}

function buildEndEvent(node) {
  return `    <endEvent id="${esc(node.id)}" name="${esc(node.name || "")}" />`;
}

function buildUserTask(node) {
  const attrs = [`id="${esc(node.id)}"`];
  if (node.name) attrs.push(`name="${esc(node.name)}"`);
  if (node.assignee) attrs.push(`flowable:assignee="${esc(node.assignee)}"`);
  if (node.candidateUsers) attrs.push(`flowable:candidateUsers="${esc(node.candidateUsers)}"`);
  if (node.candidateGroups) attrs.push(`flowable:candidateGroups="${esc(node.candidateGroups)}"`);
  if (node.formKey) attrs.push(`flowable:formKey="${esc(node.formKey)}"`);
  return `    <userTask ${attrs.join(" ")} />`;
}

function buildServiceTask(node) {
  const attrs = [`id="${esc(node.id)}"`];
  if (node.name) attrs.push(`name="${esc(node.name)}"`);
  if (node.delegateExpression) attrs.push(`flowable:delegateExpression="${esc(node.delegateExpression)}"`);
  if (node.expression) attrs.push(`flowable:expression="${esc(node.expression)}"`);
  if (node.class) attrs.push(`flowable:class="${esc(node.class)}"`);
  return `    <serviceTask ${attrs.join(" ")} />`;
}

function buildScriptTask(node) {
  const attrs = [`id="${esc(node.id)}"`];
  if (node.name) attrs.push(`name="${esc(node.name)}"`);
  if (node.scriptFormat) attrs.push(`scriptFormat="${esc(node.scriptFormat)}"`);
  const lines = [`    <scriptTask ${attrs.join(" ")}>`];
  if (node.script) {
    lines.push(`      <script>${esc(node.script)}</script>`);
  }
  lines.push(`    </scriptTask>`);
  return lines.join("\n");
}

function buildGateway(node) {
  const typeMap = {
    exclusiveGateway: "exclusiveGateway",
    parallelGateway: "parallelGateway",
    inclusiveGateway: "inclusiveGateway",
  };
  const tag = typeMap[node.type];
  if (!tag) return `    <!-- unsupported gateway type: ${esc(node.type)} -->`;
  return `    <${tag} id="${esc(node.id)}" name="${esc(node.name || "")}" />`;
}

function buildCallActivity(node) {
  const attrs = [`id="${esc(node.id)}"`];
  if (node.name) attrs.push(`name="${esc(node.name)}"`);
  if (node.calledElement) attrs.push(`calledElement="${esc(node.calledElement)}"`);
  return `    <callActivity ${attrs.join(" ")} />`;
}

function buildSubProcess(node) {
  const attrs = [`id="${esc(node.id)}"`];
  if (node.name) attrs.push(`name="${esc(node.name)}"`);
  return `    <subProcess ${attrs.join(" ")}>\n    </subProcess>`;
}

// ─── Sequence flow builder ────────────────────────────────

function buildSequenceFlow(edge) {
  const attrs = [`id="${esc(edge.id)}"`, `sourceRef="${esc(edge.source)}"`, `targetRef="${esc(edge.target)}"`];
  if (!edge.condition) {
    return `    <sequenceFlow ${attrs.join(" ")} />`;
  }
  return (
    `    <sequenceFlow ${attrs.join(" ")}>\n` +
    `      <conditionExpression xsi:type="tFormalExpression">${esc(edge.condition)}</conditionExpression>\n` +
    `    </sequenceFlow>`
  );
}

// ─── DI builders ──────────────────────────────────────────

const NODE_SIZES = {
  startEvent: { w: 36, h: 36 },
  endEvent: { w: 36, h: 36 },
  userTask: { w: 100, h: 80 },
  serviceTask: { w: 100, h: 80 },
  scriptTask: { w: 100, h: 80 },
  exclusiveGateway: { w: 50, h: 50 },
  parallelGateway: { w: 50, h: 50 },
  inclusiveGateway: { w: 50, h: 50 },
  callActivity: { w: 100, h: 80 },
  subProcess: { w: 300, h: 200 },
};

function buildBpmnShape(node, idx) {
  const size = NODE_SIZES[node.type] || { w: 100, h: 80 };
  const x = node.x ?? 100 + idx * 200;
  const y = node.y ?? 200;
  return (
    `      <bpmndi:BPMNShape id="BPMNShape_${esc(node.id)}" bpmnElement="${esc(node.id)}">\n` +
    `        <dc:Bounds x="${x}" y="${y}" width="${size.w}" height="${size.h}" />\n` +
    `      </bpmndi:BPMNShape>`
  );
}

function buildBpmnEdge(edge, nodeMap) {
  const source = nodeMap[edge.source];
  const target = nodeMap[edge.target];
  if (!source || !target) return "";

  const sSize = NODE_SIZES[source.type] || { w: 100, h: 80 };
  const tSize = NODE_SIZES[target.type] || { w: 100, h: 80 };

  const sx = (source.x ?? 0) + sSize.w / 2;
  const sy = (source.y ?? 0) + sSize.h / 2;
  const tx = (target.x ?? 0) + tSize.w / 2;
  const ty = (target.y ?? 0) + tSize.h / 2;

  // Simple waypoint: start -> mid -> end
  const mx = (sx + tx) / 2;

  return (
    `      <bpmndi:BPMNEdge id="BPMNEdge_${esc(edge.id)}" bpmnElement="${esc(edge.id)}">\n` +
    `        <di:waypoint x="${sx}" y="${sy}" />\n` +
    `        <di:waypoint x="${mx}" y="${sy}" />\n` +
    `        <di:waypoint x="${mx}" y="${ty}" />\n` +
    `        <di:waypoint x="${tx}" y="${ty}" />\n` +
    `      </bpmndi:BPMNEdge>`
  );
}

// ─── Node type to builder mapping ─────────────────────────

const NODE_BUILDERS = {
  startEvent: buildStartEvent,
  endEvent: buildEndEvent,
  userTask: buildUserTask,
  serviceTask: buildServiceTask,
  scriptTask: buildScriptTask,
  exclusiveGateway: buildGateway,
  parallelGateway: buildGateway,
  inclusiveGateway: buildGateway,
  callActivity: buildCallActivity,
  subProcess: buildSubProcess,
};

// ─── Main generator ───────────────────────────────────────

/**
 * Generate BPMN 2.0 XML from a JSON process definition.
 *
 * @param {object} definition - Process definition object
 * @param {string} definition.id - Process ID
 * @param {string} definition.name - Process name
 * @param {Array} definition.nodes - Array of flow nodes
 * @param {Array} definition.edges - Array of sequence flows
 * @returns {string} BPMN 2.0 XML string
 */
export function generateBpmnXml(definition) {
  const { id, name, nodes = [], edges = [] } = definition;

  // Build node lookup for DI edge calculations
  const nodeMap = {};
  for (const node of nodes) {
    nodeMap[node.id] = node;
  }

  // Build process elements
  const processElements = [];
  for (const node of nodes) {
    const builder = NODE_BUILDERS[node.type];
    if (builder) {
      processElements.push(builder(node));
    } else {
      processElements.push(`    <!-- unsupported node type: ${esc(node.type)} id=${esc(node.id)} -->`);
    }
  }

  // Build sequence flows
  const sequenceFlows = edges.map(buildSequenceFlow);

  // Build DI shapes
  const shapes = nodes.map((node, idx) => buildBpmnShape(node, idx));

  // Build DI edges
  const diEdges = edges.map(edge => buildBpmnEdge(edge, nodeMap)).filter(Boolean);

  // Assemble the full XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="${BPMN_NS}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:flowable="http://flowable.org/bpmn"
  xmlns:bpmndi="${BPMNDI_NS}"
  xmlns:dc="${DC_NS}"
  xmlns:di="${DI_NS}"
  targetNamespace="http://www.flowable.org/processdef">

  <process id="${esc(id)}" name="${esc(name || id)}" isExecutable="true">
${processElements.join("\n")}
${sequenceFlows.join("\n")}
  </process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_${esc(id)}">
    <bpmndi:BPMNPlane bpmnElement="${esc(id)}" id="BPMNPlane_${esc(id)}">
${shapes.join("\n")}
${diEdges.join("\n")}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

  return xml;
}

export default generateBpmnXml;
