/**
 * Mate: 节点库 17 种 type 的专属卡片渲染
 * -----------------------------------------------
 * 每种 FlowNodeRegistry 都拥有自己的 formMeta.render：
 *  - 顶部一条分类彩条
 *  - 图标 + 标题（对应节点库语义）
 *  - 关键参数（不是通用 input，而是该 type 真实业务字段）
 *
 * 通过 `AC_NODE_RENDER_REGISTRIES` 与现有 ALL_NODE_REGISTRIES 合并后传入
 * FlowgramEditor，FlowGram 会按 type 查找对应 formMeta.render。
 */
import {
  Circle, CircleDot, UserCheck, Settings, Diamond, PlusSquare,
  Sparkles, FileText, Wrench, BookOpen, Bot, Bell, Hourglass, Database, Zap,
  FileInput, Link2, GitBranch, Repeat, Combine,
} from 'lucide-react';
import { ALL_NODE_REGISTRIES } from '@mate/shared/flow';
import React from 'react';

type Registry = (typeof ALL_NODE_REGISTRIES)[number];

interface NodeVis { Icon: typeof Circle; accent: 'bpmn'|'ai'|'business'|'data'|'trigger'|'control'; }

const NODE_VIS: Record<string, NodeVis> = {
  bpmnStart: { Icon: Circle, accent: 'bpmn' },
  bpmnEnd: { Icon: CircleDot, accent: 'bpmn' },
  bpmnUserTask: { Icon: UserCheck, accent: 'bpmn' },
  bpmnServiceTask: { Icon: Settings, accent: 'bpmn' },
  bpmnGatewayExclusive: { Icon: Diamond, accent: 'bpmn' },
  bpmnGatewayParallel: { Icon: PlusSquare, accent: 'bpmn' },
  bpmnGatewayInclusive: { Icon: CircleDot, accent: 'bpmn' },
  agent_input: { Icon: FileInput, accent: 'ai' },
  agent_output: { Icon: FileText, accent: 'ai' },
  agent_llm: { Icon: Sparkles, accent: 'ai' },
  agent_tool: { Icon: Wrench, accent: 'ai' },
  agent_knowledge: { Icon: BookOpen, accent: 'ai' },
  agent_if: { Icon: GitBranch, accent: 'ai' },
  agent_loop: { Icon: Repeat, accent: 'ai' },
  business_trigger: { Icon: Zap, accent: 'trigger' },
  business_notify: { Icon: Bell, accent: 'business' },
  business_delay: { Icon: Hourglass, accent: 'business' },
};

export const AC_NODE_CARD_CSS = `
  .acp-dropzone .demo-fixed-node { cursor: grab; }
  .acp-dropzone .demo-fixed-node:active { cursor: grabbing; }
  .acp-dropzone .demo-fixed-node * { user-select: none; }
  .ac-node-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: 0 1px 0 rgba(0,0,0,0.04); }
  .ac-node-card-bar { height: 3px; }
  .ac-node-card-bar.bpmn     { background: var(--info); }
  .ac-node-card-bar.ai       { background: var(--purple); }
  .ac-node-card-bar.business { background: var(--success); }
  .ac-node-card-bar.data     { background: var(--warning); }
  .ac-node-card-bar.trigger  { background: #e879f9; }
  .ac-node-card-bar.control  { background: var(--muted-foreground); }
  .ac-node-card-body { padding: 8px 10px 10px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
  .ac-node-card-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--foreground); }
  .ac-node-card-icon { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ac-node-card-icon svg { width: 13px; height: 13px; }
  .ac-node-card-icon.bpmn     { background: var(--info-subtle);     color: var(--info); }
  .ac-node-card-icon.ai       { background: var(--purple-subtle);   color: var(--purple); }
  .ac-node-card-icon.business { background: var(--success-subtle);  color: var(--success); }
  .ac-node-card-icon.data     { background: var(--warning-subtle);  color: var(--warning); }
  .ac-node-card-icon.trigger  { background: rgba(232,121,249,0.1);  color: #e879f9; }
  .ac-node-card-icon.control  { background: var(--muted);           color: var(--muted-foreground); }
  .ac-node-card-desc { font-size: 11px; color: var(--muted-foreground); line-height: 1.4; }
  .ac-node-card-fields { display: flex; flex-direction: column; gap: 4px; border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 2px; }
  .ac-node-card-field { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted-foreground); font-family: var(--font-mono); }
  .ac-node-card-field b { color: var(--foreground); font-weight: 500; font-family: var(--font-sans); }
  .ac-node-card-pill { background: var(--muted); border: 1px solid var(--border); border-radius: 9999px; padding: 1px 6px; font-size: 10px; font-family: var(--font-sans); color: var(--foreground); }
  .ac-node-card-cron { font-family: var(--font-mono); font-size: 10px; color: var(--muted-foreground); background: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; }
`;

function Card({ accent, Icon, title, desc, children }: { accent: NodeVis['accent']; Icon: typeof Circle; title: string; desc: string; children?: React.ReactNode; }) {
  return (
    <div className="ac-node-card">
      <div className={`ac-node-card-bar ${accent}`} />
      <div className="ac-node-card-body">
        <div className="ac-node-card-head">
          <span className={`ac-node-card-icon ${accent}`}><Icon /></span>
          <span>{title}</span>
        </div>
        <div className="ac-node-card-desc">{desc}</div>
        {children}
      </div>
    </div>
  );
}

function Fields({ children }: { children: React.ReactNode }) { return <div className="ac-node-card-fields">{children}</div>; }
function FieldRow({ k, v }: { k: string; v: React.ReactNode }) { return <div className="ac-node-card-field"><span style={{ minWidth: 56 }}>{k}</span><b>{v}</b></div>; }

function BpmnStart() { return <Card accent="bpmn" Icon={Circle} title="开始事件" desc="流程入口"><Fields><FieldRow k="事件类型" v={<span className="ac-node-card-pill">None</span>} /></Fields></Card>; }
function BpmnEnd() { return <Card accent="bpmn" Icon={CircleDot} title="结束事件" desc="流程出口"><Fields><FieldRow k="事件类型" v={<span className="ac-node-card-pill">None</span>} /></Fields></Card>; }
function BpmnUserTask() { return <Card accent="bpmn" Icon={UserCheck} title="用户任务" desc="审批人 / 处理人待办"><Fields><FieldRow k="处理人" v="主管 / HR" /><FieldRow k="超时" v="24h" /></Fields></Card>; }
function BpmnServiceTask() { return <Card accent="bpmn" Icon={Settings} title="服务任务" desc="调用后端 API / 脚本"><Fields><FieldRow k="方法" v={<span className="ac-node-card-pill">HTTP POST</span>} /><FieldRow k="端点" v="/api/v1/wfe/task" /></Fields></Card>; }
function BpmnGatewayExclusive() { return <Card accent="bpmn" Icon={Diamond} title="排他网关" desc="XOR · 单分支路由"><Fields><FieldRow k="条件" v="days ≥ 3" /></Fields></Card>; }
function BpmnGatewayParallel() { return <Card accent="bpmn" Icon={PlusSquare} title="并行网关" desc="AND · 多路分支"><Fields><FieldRow k="分支数" v="N" /></Fields></Card>; }
function BpmnGatewayInclusive() { return <Card accent="bpmn" Icon={CircleDot} title="包容网关" desc="OR · 多分支合并"><Fields><FieldRow k="策略" v="多路汇聚" /></Fields></Card>; }

function AgentInput() { return <Card accent="ai" Icon={FileInput} title="Agent 输入" desc="接收 HTTP / 消息 / 文件"><Fields><FieldRow k="来源" v={<span className="ac-node-card-pill">HTTP</span>} /></Fields></Card>; }
function AgentOutput() { return <Card accent="ai" Icon={FileText} title="Agent 输出" desc="写入数据库 / 知识图谱"><Fields><FieldRow k="目标" v={<span className="ac-node-card-pill">ONT</span>} /></Fields></Card>; }
function AgentLLM() { return <Card accent="ai" Icon={Sparkles} title="LLM 调用" desc="大模型推理"><Fields><FieldRow k="模型" v="doubao-pro-32k" /><FieldRow k="温度" v="0.7" /></Fields></Card>; }
function AgentTool() { return <Card accent="ai" Icon={Wrench} title="MCP 工具" desc="Function Calling / MCP 调用"><Fields><FieldRow k="协议" v={<span className="ac-node-card-pill">MCP</span>} /></Fields></Card>; }
function AgentKnowledge() { return <Card accent="ai" Icon={BookOpen} title="知识检索" desc="向量库 / 知识图谱 RAG 召回"><Fields><FieldRow k="Top-K" v="5" /></Fields></Card>; }
function AgentIf() { return <Card accent="ai" Icon={GitBranch} title="Agent 条件分支" desc="检查必填字段"><Fields><FieldRow k="条件" v="字段齐全?" /></Fields></Card>; }
function AgentLoop() { return <Card accent="ai" Icon={Repeat} title="Agent 循环" desc="迭代替全缺失数据"><Fields><FieldRow k="上限" v="100" /></Fields></Card>; }

function BusinessTrigger() { return <Card accent="trigger" Icon={Zap} title="触发器" desc="定时 / 事件驱动启动流程"><Fields><FieldRow k="Cron" v={<span className="ac-node-card-cron">0 9 * * *</span>} /></Fields></Card>; }
function BusinessNotify() { return <Card accent="business" Icon={Bell} title="通知抄送" desc="通知抄送人（不阻塞流程）"><Fields><FieldRow k="渠道" v={<span className="ac-node-card-pill">IM</span>} /></Fields></Card>; }
function BusinessDelay() { return <Card accent="business" Icon={Hourglass} title="定时器" desc="延时 / 定时触发"><Fields><FieldRow k="等待" v="24h" /></Fields></Card>; }

function NodeCard({ type }: { type: string }) {
  const map: Record<string, () => JSX.Element> = {
    bpmnStart: BpmnStart, bpmnEnd: BpmnEnd, bpmnUserTask: BpmnUserTask, bpmnServiceTask: BpmnServiceTask,
    bpmnGatewayExclusive: BpmnGatewayExclusive, bpmnGatewayParallel: BpmnGatewayParallel, bpmnGatewayInclusive: BpmnGatewayInclusive,
    agent_input: AgentInput, agent_output: AgentOutput, agent_llm: AgentLLM, agent_tool: AgentTool,
    agent_knowledge: AgentKnowledge, agent_if: AgentIf, agent_loop: AgentLoop,
    business_trigger: BusinessTrigger, business_notify: BusinessNotify, business_delay: BusinessDelay,
  };
  const C = map[type];
  if (C) return <C />;
  return <div className="ac-node-card"><div className="ac-node-card-bar control" /><div className="ac-node-card-body"><div className="ac-node-card-desc">{type}（未定制）</div></div></div>;
}

export const AC_NODE_RENDER_REGISTRIES: Registry[] = (
  [
    'bpmnStart','bpmnEnd','bpmnUserTask','bpmnServiceTask','bpmnGatewayExclusive','bpmnGatewayParallel','bpmnGatewayInclusive',
    'agent_input','agent_output','agent_llm','agent_tool','agent_knowledge','agent_if','agent_loop',
    'business_trigger','business_notify','business_delay',
  ] as const
).map<Registry>((type) => ({
  type,
  meta: { defaultExpanded: true },
  formMeta: { render: () => <NodeCard type={type} /> },
}));
