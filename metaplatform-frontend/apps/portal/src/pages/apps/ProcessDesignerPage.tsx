import { useNavigate } from 'react-router-dom';
import {
  Workflow, Undo2, Redo2, Minus, Plus, Maximize2, Eye, Play, Upload, Save,
  Play as PlayIcon, Square, UserCheck, Cpu, GitMerge, GitFork, ArrowRight, Layers,
  LayoutGrid, Search, Shield,
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAppTabs } from '@/store/appTabs';

const APP_SUB_TABS = [
  { label: '应用详情', path: '/apps/detail' },
  { label: '数据建模', path: '/apps/modeling' },
  { label: '表单设计器', path: '/apps/formdesigner' },
  { label: '流程设计器', path: '/apps/processdesigner' },
  { label: '应用配置', path: '/apps/config' },
  { label: '发布管理', path: '/apps/publish' },
  { label: '版本管理', path: '/apps/version' },
];

// MOCK: 组件面板数据
const PALETTE_SECTIONS = [
  { title: '事件', items: [
    { icon: PlayIcon, name: '开始事件', desc: '流程入口', iconClass: 'event-start' },
    { icon: Square, name: '结束事件', desc: '流程出口', iconClass: 'event-end' },
  ]},
  { title: '任务', items: [
    { icon: UserCheck, name: '用户任务', desc: '人工审批/处理', iconClass: '' },
    { icon: Cpu, name: '服务任务', desc: '自动执行', iconClass: '' },
  ]},
  { title: '网关', items: [
    { icon: GitMerge, name: '排他网关', desc: '条件分支', iconClass: 'gateway' },
    { icon: GitFork, name: '并行网关', desc: '并行分支', iconClass: 'gateway' },
  ]},
  { title: '连线', items: [
    { icon: ArrowRight, name: '顺序流', desc: '节点连接', iconClass: '' },
  ]},
  { title: '子流程', items: [
    { icon: Layers, name: '子流程', desc: '嵌套流程', iconClass: '' },
  ]},
];

export default function ProcessDesignerPage() {
  const navigate = useNavigate();
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  const iconBg = (cls: string) => {
    if (cls === 'event-start') return { borderColor: 'var(--success)', background: 'var(--success-subtle)', color: 'var(--success)' };
    if (cls === 'event-end') return { borderColor: 'var(--destructive)', background: 'rgba(255,97,102,.08)', color: 'var(--destructive)' };
    if (cls === 'gateway') return { borderColor: 'var(--warning)', background: 'var(--warning-subtle)', color: 'var(--warning)' };
    return { borderColor: 'var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      {/* Top Toolbar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Workflow style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>请假审批流程</span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>v2.1</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          <button className="v-btn" style={{ height: 28, fontSize: 11, padding: '0 8px' }}><Undo2 style={{ width: 14, height: 14 }} />撤销</button>
          <button className="v-btn" style={{ height: 28, fontSize: 11, padding: '0 8px' }}><Redo2 style={{ width: 14, height: 14 }} />重做</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 2 }}>
            <button style={{ width: 28, height: 28, borderRadius: 3, border: 'none', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus style={{ width: 14, height: 14 }} /></button>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', padding: '0 6px', minWidth: 36, textAlign: 'center' }}>100%</span>
            <button style={{ width: 28, height: 28, borderRadius: 3, border: 'none', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus style={{ width: 14, height: 14 }} /></button>
            <button style={{ width: 28, height: 28, borderRadius: 3, border: 'none', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 style={{ width: 14, height: 14 }} /></button>
          </div>
          <button className="v-btn"><Eye style={{ width: 14, height: 14 }} />预览</button>
          <button className="v-btn"><Play style={{ width: 14, height: 14 }} />模拟运行</button>
          <button className="v-btn-primary"><Upload style={{ width: 14, height: 14 }} />发布</button>
          <button className="v-btn-primary"><Save style={{ width: 14, height: 14 }} />保存</button>
        </div>
      </div>

      {/* Designer Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 12, gap: 12 }}>
        {/* Left: Palette */}
        <div style={{ width: 200, flexShrink: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 10px', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>组件面板</div>
          <div style={{ padding: '10px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            <input type="text" placeholder="搜索组件..." style={{ width: '100%', height: 30, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {PALETTE_SECTIONS.map((section, si) => (
              <div key={si} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', padding: '6px 8px 4px' }}>{section.title}</div>
                {section.items.map((item, ii) => {
                  const PIcon = item.icon;
                  const bg = iconBg(item.iconClass);
                  return (
                    <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 'var(--radius)', cursor: 'grab', fontSize: 13, color: 'var(--foreground)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', border: `1px solid ${bg.borderColor}`, background: bg.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <PIcon style={{ width: 16, height: 16, color: bg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Center: BPMN Canvas */}
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', minHeight: 450, position: 'relative', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35, backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <svg width="820" height="520" viewBox="0 0 820 520" style={{ flexShrink: 0 }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--border)" />
              </marker>
              <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--muted-foreground)" />
              </marker>
            </defs>
            {/* Edges */}
            <line x1="90" y1="60" x2="165" y2="60" stroke="var(--border)" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />
            <line x1="295" y1="60" x2="355" y2="60" stroke="var(--border)" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />
            <line x1="495" y1="60" x2="543" y2="60" stroke="var(--border)" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />
            <polyline points="575,92 575,180 650,180" stroke="var(--border)" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />
            <text x="590" y="135" fill="var(--success)" fontSize="10" fontFamily="Geist,sans-serif">批准</text>
            <polyline points="575,92 575,180 330,180 330,330" stroke="var(--border)" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />
            <text x="430" y="172" fill="var(--destructive)" fontSize="10" fontFamily="Geist,sans-serif">驳回</text>
            <line x1="780" y1="180" x2="780" y2="440" stroke="var(--border)" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />
            <polyline points="255,350 120,350 120,82" stroke="var(--muted-foreground)" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead-active)" strokeDasharray="5 3" />
            <text x="155" y="342" fill="var(--destructive)" fontSize="10" fontFamily="Geist,sans-serif" textAnchor="middle">重新提交</text>

            {/* Start Event */}
            <circle cx="60" cy="60" r="26" fill="var(--success-subtle)" stroke="var(--success)" strokeWidth="2" />
            <polygon points="52,60 64,52 64,68" fill="var(--success)" />
            <text x="60" y="100" fill="var(--muted-foreground)" fontSize="10" textAnchor="middle" fontFamily="Geist,sans-serif">开始</text>

            {/* 提交申请 */}
            <rect x="165" y="35" width="130" height="50" fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" rx="4" />
            <text x="230" y="57" fill="var(--foreground)" fontSize="12" textAnchor="middle" fontFamily="Geist,sans-serif">提交申请</text>
            <text x="230" y="72" fill="var(--muted-foreground)" fontSize="10" textAnchor="middle" fontFamily="Geist,sans-serif">用户任务</text>

            {/* 主管审批 - SELECTED */}
            <rect x="355" y="35" width="140" height="50" fill="var(--muted)" stroke="var(--foreground)" strokeWidth="2" rx="4" />
            <circle cx="355" cy="35" r="3" fill="var(--foreground)" />
            <circle cx="495" cy="35" r="3" fill="var(--foreground)" />
            <circle cx="355" cy="85" r="3" fill="var(--foreground)" />
            <circle cx="495" cy="85" r="3" fill="var(--foreground)" />
            <text x="425" y="57" fill="var(--foreground)" fontSize="12" textAnchor="middle" fontFamily="Geist,sans-serif">主管审批</text>
            <text x="425" y="72" fill="var(--muted-foreground)" fontSize="10" textAnchor="middle" fontFamily="Geist,sans-serif">用户任务</text>

            {/* 排他网关 */}
            <g transform="translate(575,60)">
              <rect x="-17" y="-17" width="34" height="34" fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" transform="rotate(45)" />
              <line x1="-8" y1="-8" x2="8" y2="8" stroke="var(--warning)" strokeWidth="1.5" />
              <line x1="8" y1="-8" x2="-8" y2="8" stroke="var(--warning)" strokeWidth="1.5" />
            </g>
            <text x="575" y="100" fill="var(--muted-foreground)" fontSize="10" textAnchor="middle" fontFamily="Geist,sans-serif">排他网关</text>

            {/* HR备案 */}
            <rect x="650" y="155" width="130" height="50" fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" rx="4" />
            <text x="715" y="177" fill="var(--foreground)" fontSize="12" textAnchor="middle" fontFamily="Geist,sans-serif">HR 备案</text>
            <text x="715" y="192" fill="var(--muted-foreground)" fontSize="10" textAnchor="middle" fontFamily="Geist,sans-serif">服务任务</text>

            {/* 通知申请人 */}
            <rect x="255" y="325" width="150" height="50" fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" rx="4" />
            <text x="335" y="347" fill="var(--foreground)" fontSize="12" textAnchor="middle" fontFamily="Geist,sans-serif">通知申请人</text>
            <text x="335" y="362" fill="var(--muted-foreground)" fontSize="10" textAnchor="middle" fontFamily="Geist,sans-serif">服务任务</text>

            {/* End Event */}
            <circle cx="780" cy="468" r="26" fill="var(--muted)" stroke="var(--destructive)" strokeWidth="2" />
            <circle cx="780" cy="468" r="20" fill="none" stroke="var(--destructive)" strokeWidth="2" />
            <text x="780" y="505" fill="var(--muted-foreground)" fontSize="10" textAnchor="middle" fontFamily="Geist,sans-serif">结束</text>
          </svg>
        </div>

        {/* Right: Properties Panel */}
        <div style={{ width: 280, flexShrink: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 10px', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>节点属性</span>
            <span style={{ fontSize: 11, color: 'var(--success)', background: 'var(--success-subtle)', border: '1px solid rgba(98,209,120,.2)', padding: '1px 8px', borderRadius: 'var(--radius)', fontWeight: 500, textTransform: 'none' }}>用户任务</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Basic Info */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '12px 14px 8px' }}>基本信息</div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>节点 ID</div>
                <input className="v-input" value="Task_ManagerApproval" readOnly style={{ width: '100%', background: 'var(--background)', color: 'var(--muted-foreground)', cursor: 'default', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              </div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>名称</div>
                <input className="v-input" defaultValue="主管审批" style={{ width: '100%' }} />
              </div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>类型</div>
                <input className="v-input" value="用户任务 (UserTask)" readOnly style={{ width: '100%', background: 'var(--background)', color: 'var(--muted-foreground)', cursor: 'default' }} />
              </div>
            </div>
            {/* Assignment */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '12px 14px 8px' }}>分配设置</div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>分配方式</div>
                <select className="v-input" style={{ width: '100%', cursor: 'pointer' }}><option>角色分配</option><option>指定用户</option><option>表达式</option></select>
              </div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>分配角色</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: '#8b9cf7', borderColor: 'rgba(139,156,247,.2)', background: 'rgba(139,156,247,.06)' }}><Shield style={{ width: 10, height: 10 }} /> 部门经理</span>
                </div>
              </div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>候选人</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {['张三', '李四', '王五'].map(c => (
                    <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3px 10px', fontSize: 12, color: 'var(--foreground)' }}>{c}<span style={{ cursor: 'pointer', color: 'var(--muted-foreground)' }}>×</span></span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>候选人将从角色成员中自动匹配</div>
              </div>
            </div>
            {/* Form Binding */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '12px 14px 8px' }}>表单绑定</div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>关联表单</div>
                <select className="v-input" style={{ width: '100%', cursor: 'pointer' }} defaultValue="请假申请表"><option>请假申请表</option><option>报销申请表</option><option>采购申请表</option></select>
              </div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>表单权限</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="v-input" value="可编辑" readOnly style={{ flex: 1, background: 'var(--background)', color: 'var(--muted-foreground)', cursor: 'default', fontSize: 12 }} />
                  <input className="v-input" value="必填" readOnly style={{ flex: 1, background: 'var(--background)', color: 'var(--muted-foreground)', cursor: 'default', fontSize: 12 }} />
                </div>
              </div>
            </div>
            {/* Timeout */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '12px 14px 8px' }}>超时设置</div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>启用超时</div>
                <select className="v-input" style={{ width: '100%', cursor: 'pointer' }} defaultValue="是"><option>是</option><option>否</option></select>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '0 14px', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>超时时长</div>
                  <input className="v-input" type="number" defaultValue="24" style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>单位</div>
                  <select className="v-input" style={{ width: '100%', cursor: 'pointer' }} defaultValue="小时"><option>分钟</option><option>小时</option><option>天</option></select>
                </div>
              </div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>超时动作</div>
                <select className="v-input" style={{ width: '100%', cursor: 'pointer' }} defaultValue="自动提醒"><option>自动提醒</option><option>自动转办</option><option>自动跳过</option></select>
              </div>
            </div>
            {/* Advanced */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '12px 14px 8px' }}>高级</div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>多实例</div>
                <select className="v-input" style={{ width: '100%', cursor: 'pointer' }} defaultValue="无"><option>无</option><option>会签（全部通过）</option><option>或签（任一通过）</option></select>
              </div>
              <div style={{ padding: '0 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>执行监听器</div>
                <div style={{ padding: '8px 0' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>ApprovalListener.java</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ padding: '8px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />已保存
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>分支: main</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>最后编辑: 2 分钟前</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>节点: 6</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>连线: 6</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>画布: 820 x 520</div>
        </div>
      </div>
    </div>
  );
}
