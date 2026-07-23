import { useState } from 'react';
import {
  Download, Upload, Plus, Building2, Users, Briefcase, UserPlus,
  TrendingUp, Minus, ChevronDown, ChevronRight, ChevronLeft,
  Cpu, Palette, BarChart3, Megaphone, HeartHandshake, Landmark,
  Server, Monitor, Sparkles, Container, Figma, Search, Kanban,
  Pencil, Target, Code2, UserCheck, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { SubTabs, FormDrawer, Field, TextInput, TextArea, FormSection, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { MOCK_USERS } from '@/mock'; // MOCK

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

// MOCK: 部门成员
const MOCK_MEMBERS = [
  { name: '王磊', title: '技术中心总监', position: '技术总监', group: '-', email: 'wanglei@mate.com', joinDate: '2024-03-15', status: '在职', statusType: 'active', avatar: '王', avatarBg: 'rgba(139,139,245,0.2)' },
  { name: '李明', title: '后端架构组组长', position: '架构组长', group: '后端架构组', email: 'liming@mate.com', joinDate: '2024-06-01', status: '在职', statusType: 'active', avatar: '李', avatarBg: 'rgba(98,209,120,0.15)' },
  { name: '张薇', title: '前端开发组组长', position: '前端组长', group: '前端开发组', email: 'zhangwei@mate.com', joinDate: '2024-05-20', status: '在职', statusType: 'active', avatar: '张', avatarBg: 'rgba(234,179,8,0.15)' },
  { name: '陈刚', title: '高级后端工程师', position: '高级工程师', group: '后端架构组', email: 'chengang@mate.com', joinDate: '2024-09-10', status: '在职', statusType: 'active', avatar: '陈', avatarBg: 'rgba(255,97,102,0.15)' },
  { name: '赵晨', title: 'AI 研究组组长', position: 'AI 组长', group: 'AI 研究组', email: 'zhaochen@mate.com', joinDate: '2024-07-15', status: '在职', statusType: 'active', avatar: '赵', avatarBg: 'rgba(139,139,245,0.15)' },
  { name: '刘思', title: '前端工程师', position: '前端工程师', group: '前端开发组', email: 'liusi@mate.com', joinDate: '2025-02-18', status: '在职', statusType: 'active', avatar: '刘', avatarBg: 'rgba(98,209,120,0.1)' },
  { name: '孙悦', title: '运维工程师', position: '运维工程师', group: '运维组', email: 'sunyue@mate.com', joinDate: '2025-04-22', status: '在职', statusType: 'active', avatar: '孙', avatarBg: 'rgba(234,179,8,0.1)' },
  { name: '周然', title: 'AI 研究员', position: 'AI 工程师', group: 'AI 研究组', email: 'zhouran@mate.com', joinDate: '2026-06-01', status: '试用中', statusType: 'away', avatar: '周', avatarBg: 'rgba(255,97,102,0.1)' },
];

// MOCK: KPI 数据
const MOCK_KPIS = [
  { label: '项目交付率', icon: Target, iconColor: 'var(--success)', value: '95%', barWidth: '95%', barCls: 'fill-green', tag: '+3% vs Q2', tagIcon: ArrowUpRight, tagCls: 'tag-green' },
  { label: '代码质量', icon: Code2, iconColor: '#8b8bf5', value: '92 分', barWidth: '92%', barCls: 'fill-green', tag: '+5 vs Q2', tagIcon: ArrowUpRight, tagCls: 'tag-green' },
  { label: '人员利用率', icon: UserCheck, iconColor: 'var(--warning)', value: '87%', barWidth: '87%', barCls: 'fill-yellow', tag: '持平 vs Q2', tagIcon: Minus, tagCls: 'tag-yellow' },
  { label: '预算执行', icon: Wallet, iconColor: 'var(--destructive)', value: '78%', barWidth: '78%', barCls: 'fill-red', tag: '-8% vs Q2', tagIcon: ArrowDownRight, tagCls: 'tag-red' },
];

// MOCK: 下属小组
const MOCK_SUB_TEAMS = [
  { name: '后端架构组', meta: '8 人 · 组长：李明', icon: Server, iconBg: 'rgba(139,139,245,0.15)', iconColor: '#8b8bf5' },
  { name: '前端开发组', meta: '10 人 · 组长：张薇', icon: Monitor, iconBg: 'rgba(98,209,120,0.12)', iconColor: 'var(--success)' },
  { name: 'AI 研究组', meta: '7 人 · 组长：赵晨', icon: Sparkles, iconBg: 'rgba(234,179,8,0.12)', iconColor: 'var(--warning)' },
  { name: '运维组', meta: '7 人 · 组长：孙悦', icon: Container, iconBg: '', iconColor: 'var(--muted-foreground)' },
];

const STATUS_DOT: Record<string, string> = { active: 'var(--success)', offline: 'var(--muted-foreground)', away: 'var(--warning)' };

export default function AdminOrgPage() {
  const location = useLocation();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'root': true,
    'tech': true,
    'product': true,
    'ops': false,
    'market': false,
    'hr': false,
    'finance': false,
  });
  const [selectedNode, setSelectedNode] = useState('tech');
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const toggleNode = (id: string) => setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />

      <style>{`
        .ao-page-header { margin-bottom: 24px; display: flex; align-items: flex-start; justify-content: space-between; }
        .ao-page-header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
        .ao-page-header p { font-size: 14px; color: var(--muted-foreground); }
        .ao-tab-bar { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .ao-tab-bar .v-tab { cursor: pointer; text-decoration: none; }
        .ao-overview-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .ao-overview-stat { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; position: relative; overflow: hidden; }
        .ao-overview-stat .stat-icon { width: 40px; height: 40px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .ao-overview-stat .stat-icon.icon-dept { background: rgba(139,139,245,0.15); color: #8b8bf5; }
        .ao-overview-stat .stat-icon.icon-employee { background: rgba(98,209,120,0.12); color: var(--success); }
        .ao-overview-stat .stat-icon.icon-mgmt { background: rgba(234,179,8,0.12); color: var(--warning); }
        .ao-overview-stat .stat-icon.icon-new { background: rgba(255,97,102,0.12); color: var(--destructive); }
        .ao-overview-stat .stat-label { font-size: 13px; color: var(--muted-foreground); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .ao-overview-stat .stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.03em; }
        .ao-overview-stat .stat-trend { font-size: 12px; color: var(--success); margin-top: 4px; display: flex; align-items: center; gap: 3px; }
        .ao-content-split { display: flex; gap: 20px; }
        .ao-tree-panel { width: 280px; flex-shrink: 0; }
        .ao-tree-panel .v-card { padding: 12px; }
        .ao-tree-panel-title { font-size: 13px; font-weight: 600; padding: 4px 8px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
        .ao-tree-search { margin: 0 0 10px; padding: 0 4px; }
        .ao-tree-search input { width: 100%; height: 32px; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 10px; font-size: 12px; color: var(--foreground); font-family: var(--font-sans); outline: none; }
        .ao-tree-search input:focus { border-color: var(--muted-foreground); }
        .ao-tree-search input::placeholder { color: var(--muted-foreground); }
        .ao-org-tree { list-style: none; padding: 0; }
        .ao-org-tree ul { list-style: none; padding-left: 20px; }
        .ao-org-node { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: var(--radius); cursor: pointer; border: 1px solid transparent; transition: background 0.15s; }
        .ao-org-node:hover { background: var(--muted); }
        .ao-org-node.selected { background: var(--muted); border-color: var(--border); }
        .ao-org-toggle { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--muted-foreground); cursor: pointer; }
        .ao-org-icon { width: 26px; height: 26px; border-radius: var(--radius); background: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ao-org-info { flex: 1; min-width: 0; }
        .ao-org-name { font-size: 13px; font-weight: 500; }
        .ao-org-detail { font-size: 11px; color: var(--muted-foreground); margin-top: 1px; }
        .ao-tree-children { overflow: hidden; }
        .ao-detail-panel { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
        .ao-section-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
        .ao-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .ao-info-item { display: flex; flex-direction: column; gap: 2px; }
        .ao-info-item .label { font-size: 12px; color: var(--muted-foreground); }
        .ao-info-item .value { font-size: 14px; font-weight: 500; }
        .ao-info-item .value.accent { color: var(--success); }
        .ao-filter-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .ao-filter-input { height: 34px; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 10px; font-size: 12px; color: var(--foreground); font-family: var(--font-sans); outline: none; display: flex; align-items: center; gap: 6px; }
        .ao-filter-input input { background: transparent; border: none; outline: none; color: var(--foreground); font-size: 12px; font-family: var(--font-sans); width: 140px; }
        .ao-filter-input input::placeholder { color: var(--muted-foreground); }
        .ao-filter-select { height: 34px; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 10px; font-size: 12px; color: var(--foreground); font-family: var(--font-sans); outline: none; cursor: pointer; appearance: none; min-width: 120px; }
        .ao-member-table { width: 100%; border-collapse: collapse; }
        .ao-member-table th { text-align: left; font-size: 12px; font-weight: 500; color: var(--muted-foreground); padding: 8px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .ao-member-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .ao-member-table tr:last-child td { border-bottom: none; }
        .ao-member-table tr:hover td { background: var(--muted); }
        .ao-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; color: var(--foreground); }
        .ao-avatar-cell { display: flex; align-items: center; gap: 10px; }
        .ao-avatar-cell .name-text .primary { font-size: 13px; font-weight: 500; }
        .ao-avatar-cell .name-text .secondary { font-size: 11px; color: var(--muted-foreground); }
        .ao-status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .ao-status-text { font-size: 12px; display: flex; align-items: center; gap: 5px; }
        .ao-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .ao-kpi-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; position: relative; }
        .ao-kpi-card .kpi-label { font-size: 12px; color: var(--muted-foreground); margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
        .ao-kpi-card .kpi-value { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
        .ao-kpi-card .kpi-bar { height: 4px; background: var(--muted); border-radius: 2px; margin-top: 10px; overflow: hidden; }
        .ao-kpi-card .kpi-bar-fill { height: 100%; border-radius: 2px; }
        .ao-kpi-card .kpi-bar-fill.fill-green { background: var(--success); }
        .ao-kpi-card .kpi-bar-fill.fill-yellow { background: var(--warning); }
        .ao-kpi-card .kpi-bar-fill.fill-red { background: var(--destructive); }
        .ao-kpi-card .kpi-tag { font-size: 11px; padding: 2px 6px; border-radius: var(--radius); margin-top: 8px; display: inline-flex; align-items: center; gap: 3px; }
        .ao-kpi-card .kpi-tag.tag-green { background: var(--success-subtle); color: var(--success); }
        .ao-kpi-card .kpi-tag.tag-yellow { background: var(--warning-subtle); color: var(--warning); }
        .ao-kpi-card .kpi-tag.tag-red { background: rgba(255,97,102,0.1); color: var(--destructive); }
        .ao-team-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s; cursor: pointer; }
        .ao-team-card:hover { background: var(--muted); }
        .ao-team-info { display: flex; align-items: center; gap: 10px; }
        .ao-team-icon { width: 32px; height: 32px; border-radius: var(--radius); background: var(--muted); display: flex; align-items: center; justify-content: center; }
        .ao-team-name { font-size: 13px; font-weight: 500; }
        .ao-team-meta { font-size: 12px; color: var(--muted-foreground); }
        .ao-table-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 0 4px; }
        .ao-page-nav { display: flex; gap: 4px; }
        .ao-page-btn { width: 32px; height: 32px; border-radius: var(--radius); border: 1px solid var(--border); background: transparent; color: var(--muted-foreground); font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: var(--font-sans); }
        .ao-page-btn:hover { background: var(--muted); color: var(--foreground); }
        .ao-page-btn.active { background: var(--foreground); color: var(--background); border-color: var(--foreground); }
      `}</style>
      <div style={{ padding: '24px 0' }}>
        {/* Page Header */}
        <div className="ao-page-header">
          <div>
            <h1>组织管理</h1>
            <p>部门与组织架构管理</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="v-btn"><Download style={{ width: 14, height: 14 }} />导出</button>
            <button className="v-btn"><Upload style={{ width: 14, height: 14 }} />导入</button>
            <button className="v-btn-primary"><Plus style={{ width: 14, height: 14 }} />添加部门</button>
          </div>
        </div>

        {/* Overview stats */}
        <div className="ao-overview-stats">
          <div className="ao-overview-stat">
            <div className="stat-icon icon-dept"><Building2 style={{ width: 20, height: 20 }} /></div>
            <div className="stat-label">部门总数</div>
            <div className="stat-value">12</div>
            <div className="stat-trend"><TrendingUp style={{ width: 12, height: 12 }} /> 较上月 +1</div>
          </div>
          <div className="ao-overview-stat">
            <div className="stat-icon icon-employee"><Users style={{ width: 20, height: 20 }} /></div>
            <div className="stat-label">员工总数</div>
            <div className="stat-value">156</div>
            <div className="stat-trend"><TrendingUp style={{ width: 12, height: 12 }} /> 较上月 +3</div>
          </div>
          <div className="ao-overview-stat">
            <div className="stat-icon icon-mgmt"><Briefcase style={{ width: 20, height: 20 }} /></div>
            <div className="stat-label">管理层</div>
            <div className="stat-value">18</div>
            <div className="stat-trend"><Minus style={{ width: 12, height: 12 }} /> 与上月持平</div>
          </div>
          <div className="ao-overview-stat">
            <div className="stat-icon icon-new"><UserPlus style={{ width: 20, height: 20 }} /></div>
            <div className="stat-label">本月入职</div>
            <div className="stat-value">5</div>
            <div className="stat-trend"><TrendingUp style={{ width: 12, height: 12 }} /> 较上月 +2</div>
          </div>
        </div>

        {/* Content split: tree + detail */}
        <div className="ao-content-split">
          {/* Left: Org tree */}
          <div className="ao-tree-panel">
            <div className="v-card">
              <div className="ao-tree-panel-title">
                <span>组织架构</span>
                <span className="v-meta">12 个部门</span>
              </div>
              <div className="ao-tree-search">
                <input type="text" placeholder="搜索部门..." />
              </div>
              <ul className="ao-org-tree">
                {/* Root: Mate Platform */}
                <li>
                  <div className={`ao-org-node${selectedNode === 'root' ? ' selected' : ''}`} onClick={() => setSelectedNode('root')}>
                    <div className="ao-org-toggle" onClick={(e) => { e.stopPropagation(); toggleNode('root'); }}>
                      {expandedNodes.root ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                    </div>
                    <div className="ao-org-icon"><Building2 style={{ width: 14, height: 14, color: 'var(--foreground)' }} /></div>
                    <div className="ao-org-info">
                      <div className="ao-org-name">Mate Platform</div>
                      <div className="ao-org-detail">156 人 · 12 部门</div>
                    </div>
                  </div>
                  {expandedNodes.root && (
                    <div className="ao-tree-children">
                      <ul>
                        {/* 技术中心 */}
                        <li>
                          <div className={`ao-org-node${selectedNode === 'tech' ? ' selected' : ''}`} onClick={() => setSelectedNode('tech')}>
                            <div className="ao-org-toggle" onClick={(e) => { e.stopPropagation(); toggleNode('tech'); }}>
                              {expandedNodes.tech ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                            </div>
                            <div className="ao-org-icon" style={{ background: 'rgba(139,139,245,0.15)' }}><Cpu style={{ width: 14, height: 14, color: '#8b8bf5' }} /></div>
                            <div className="ao-org-info">
                              <div className="ao-org-name">技术中心</div>
                              <div className="ao-org-detail">32 人</div>
                            </div>
                          </div>
                          {expandedNodes.tech && (
                            <div className="ao-tree-children">
                              <ul>
                                <li><div className="ao-org-node"><div className="ao-org-toggle" style={{ visibility: 'hidden' }} /><div className="ao-org-icon"><Server style={{ width: 14, height: 14, color: '#8b8bf5' }} /></div><div className="ao-org-info"><div className="ao-org-name">后端架构组</div><div className="ao-org-detail">8 人</div></div></div></li>
                                <li><div className="ao-org-node"><div className="ao-org-toggle" style={{ visibility: 'hidden' }} /><div className="ao-org-icon"><Monitor style={{ width: 14, height: 14, color: 'var(--success)' }} /></div><div className="ao-org-info"><div className="ao-org-name">前端开发组</div><div className="ao-org-detail">10 人</div></div></div></li>
                                <li><div className="ao-org-node"><div className="ao-org-toggle" style={{ visibility: 'hidden' }} /><div className="ao-org-icon"><Sparkles style={{ width: 14, height: 14, color: 'var(--warning)' }} /></div><div className="ao-org-info"><div className="ao-org-name">AI 研究组</div><div className="ao-org-detail">7 人</div></div></div></li>
                                <li><div className="ao-org-node"><div className="ao-org-toggle" style={{ visibility: 'hidden' }} /><div className="ao-org-icon"><Container style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} /></div><div className="ao-org-info"><div className="ao-org-name">运维组</div><div className="ao-org-detail">7 人</div></div></div></li>
                              </ul>
                            </div>
                          )}
                        </li>
                        {/* 产品中心 */}
                        <li>
                          <div className={`ao-org-node${selectedNode === 'product' ? ' selected' : ''}`} onClick={() => setSelectedNode('product')}>
                            <div className="ao-org-toggle" onClick={(e) => { e.stopPropagation(); toggleNode('product'); }}>
                              {expandedNodes.product ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                            </div>
                            <div className="ao-org-icon" style={{ background: 'rgba(98,209,120,0.12)' }}><Palette style={{ width: 14, height: 14, color: 'var(--success)' }} /></div>
                            <div className="ao-org-info">
                              <div className="ao-org-name">产品中心</div>
                              <div className="ao-org-detail">28 人</div>
                            </div>
                          </div>
                          {expandedNodes.product && (
                            <div className="ao-tree-children">
                              <ul>
                                <li><div className="ao-org-node"><div className="ao-org-toggle" style={{ visibility: 'hidden' }} /><div className="ao-org-icon"><Figma style={{ width: 14, height: 14, color: 'var(--success)' }} /></div><div className="ao-org-info"><div className="ao-org-name">产品设计组</div><div className="ao-org-detail">12 人</div></div></div></li>
                                <li><div className="ao-org-node"><div className="ao-org-toggle" style={{ visibility: 'hidden' }} /><div className="ao-org-icon"><Search style={{ width: 14, height: 14, color: 'var(--success)' }} /></div><div className="ao-org-info"><div className="ao-org-name">用户研究组</div><div className="ao-org-detail">8 人</div></div></div></li>
                                <li><div className="ao-org-node"><div className="ao-org-toggle" style={{ visibility: 'hidden' }} /><div className="ao-org-icon"><Kanban style={{ width: 14, height: 14, color: 'var(--success)' }} /></div><div className="ao-org-info"><div className="ao-org-name">项目管理组</div><div className="ao-org-detail">8 人</div></div></div></li>
                              </ul>
                            </div>
                          )}
                        </li>
                        {/* 运营中心 */}
                        <li>
                          <div className="ao-org-node">
                            <div className="ao-org-toggle" onClick={() => toggleNode('ops')}><ChevronRight style={{ width: 14, height: 14 }} /></div>
                            <div className="ao-org-icon" style={{ background: 'rgba(234,179,8,0.12)' }}><BarChart3 style={{ width: 14, height: 14, color: 'var(--warning)' }} /></div>
                            <div className="ao-org-info"><div className="ao-org-name">运营中心</div><div className="ao-org-detail">24 人</div></div>
                          </div>
                        </li>
                        {/* 市场销售部 */}
                        <li>
                          <div className="ao-org-node">
                            <div className="ao-org-toggle"><ChevronRight style={{ width: 14, height: 14 }} /></div>
                            <div className="ao-org-icon"><Megaphone style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} /></div>
                            <div className="ao-org-info"><div className="ao-org-name">市场销售部</div><div className="ao-org-detail">20 人</div></div>
                          </div>
                        </li>
                        {/* 人力资源部 */}
                        <li>
                          <div className="ao-org-node">
                            <div className="ao-org-toggle"><ChevronRight style={{ width: 14, height: 14 }} /></div>
                            <div className="ao-org-icon"><HeartHandshake style={{ width: 14, height: 14, color: 'var(--destructive)' }} /></div>
                            <div className="ao-org-info"><div className="ao-org-name">人力资源部</div><div className="ao-org-detail">8 人</div></div>
                          </div>
                        </li>
                        {/* 财务部 */}
                        <li>
                          <div className="ao-org-node">
                            <div className="ao-org-toggle"><ChevronRight style={{ width: 14, height: 14 }} /></div>
                            <div className="ao-org-icon"><Landmark style={{ width: 14, height: 14, color: '#8b8bf5' }} /></div>
                            <div className="ao-org-info"><div className="ao-org-name">财务部</div><div className="ao-org-detail">6 人</div></div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  )}
                </li>
              </ul>
            </div>
          </div>

          {/* Right: Detail panel (技术中心 selected) */}
          <div className="ao-detail-panel">
            {/* Department info card */}
            <div className="v-card">
              <div className="ao-section-title">
                <span>部门信息</span>
                <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setEditDrawerOpen(true)}><Pencil style={{ width: 12, height: 12 }} />编辑</button>
              </div>
              <div className="ao-info-grid">
                <div className="ao-info-item"><span className="label">部门名称</span><span className="value">技术中心</span></div>
                <div className="ao-info-item"><span className="label">负责人</span><span className="value">王磊</span></div>
                <div className="ao-info-item"><span className="label">成立时间</span><span className="value">2025-03-15</span></div>
                <div className="ao-info-item"><span className="label">人员编制</span><span className="value accent">32 / 35</span></div>
                <div className="ao-info-item"><span className="label">年度预算</span><span className="value">¥ 480 万</span></div>
                <div className="ao-info-item"><span className="label">预算执行</span><span className="value">78%</span></div>
                <div className="ao-info-item"><span className="label">上级部门</span><span className="value">Mate Platform</span></div>
                <div className="ao-info-item"><span className="label">下属小组</span><span className="value">4 个</span></div>
              </div>
            </div>

            {/* KPI dashboard */}
            <div className="v-card">
              <div className="ao-section-title">
                <span>部门 KPI 看板</span>
                <span className="v-meta">Q3 2026</span>
              </div>
              <div className="ao-kpi-grid">
                {MOCK_KPIS.map((kpi, i) => {
                  const Icon = kpi.icon;
                  const TagIcon = kpi.tagIcon;
                  return (
                    <div key={i} className="ao-kpi-card">
                      <div className="kpi-label"><Icon style={{ width: 13, height: 13, color: kpi.iconColor }} />{kpi.label}</div>
                      <div className="kpi-value">{kpi.value}</div>
                      <div className="kpi-bar"><div className={`kpi-bar-fill ${kpi.barCls}`} style={{ width: kpi.barWidth }} /></div>
                      <div className={`kpi-tag ${kpi.tagCls}`}><TagIcon style={{ width: 10, height: 10 }} />{kpi.tag}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Member table */}
            <div className="v-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="ao-section-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>部门成员</span>
                  <span className="v-meta">共 32 人</span>
                </div>
                <button className="v-btn-primary" style={{ height: 28, padding: '0 10px', fontSize: 12 }}><UserPlus style={{ width: 12, height: 12 }} />添加成员</button>
              </div>

              {/* Filter bar */}
              <div className="ao-filter-bar" style={{ marginBottom: 12 }}>
                <div className="ao-filter-input">
                  <Search style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                  <input type="text" placeholder="搜索成员姓名..." />
                </div>
                <select className="ao-filter-select"><option value="">全部小组</option><option value="backend">后端架构组</option><option value="frontend">前端开发组</option><option value="ai">AI 研究组</option><option value="devops">运维组</option></select>
                <select className="ao-filter-select"><option value="">全部职位</option><option value="director">总监/主管</option><option value="lead">组长/负责人</option><option value="senior">高级工程师</option><option value="engineer">工程师</option></select>
                <select className="ao-filter-select"><option value="">全部状态</option><option value="active">在职</option><option value="probation">试用中</option><option value="inactive">已离职</option></select>
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                <table className="ao-member-table">
                  <thead>
                    <tr>
                      {['姓名', '职位', '小组', '邮箱', '入职时间', '状态'].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_MEMBERS.map((m, i) => (
                      <tr key={i}>
                        <td>
                          <div className="ao-avatar-cell">
                            <div className="ao-avatar" style={{ background: m.avatarBg }}>{m.avatar}</div>
                            <div className="name-text"><div className="primary">{m.name}</div><div className="secondary">{m.title}</div></div>
                          </div>
                        </td>
                        <td>{m.position}</td>
                        <td>{m.group === '-' ? <span className="v-badge v-badge-neutral">-</span> : <span className="v-badge v-badge-neutral">{m.group}</span>}</td>
                        <td style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{m.email}</td>
                        <td style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{m.joinDate}</td>
                        <td><span className="ao-status-text"><span className="ao-status-dot" style={{ background: STATUS_DOT[m.statusType] }} />{m.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ao-table-footer">
                <span className="v-meta">显示 1-8 / 共 32 条</span>
                <div className="ao-page-nav">
                  <button className="ao-page-btn"><ChevronLeft style={{ width: 14, height: 14 }} /></button>
                  <button className="ao-page-btn active">1</button>
                  <button className="ao-page-btn">2</button>
                  <button className="ao-page-btn">3</button>
                  <button className="ao-page-btn">4</button>
                  <button className="ao-page-btn"><ChevronRight style={{ width: 14, height: 14 }} /></button>
                </div>
              </div>
            </div>

            {/* Sub teams overview */}
            <div className="v-card">
              <div className="ao-section-title">
                <span>下属小组</span>
                <span className="v-meta">4 个小组</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MOCK_SUB_TEAMS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} className="ao-team-card">
                      <div className="ao-team-info">
                        <div className="ao-team-icon" style={{ background: t.iconBg || 'var(--muted)' }}><Icon style={{ width: 16, height: 16, color: t.iconColor }} /></div>
                        <div>
                          <div className="ao-team-name">{t.name}</div>
                          <div className="ao-team-meta">{t.meta}</div>
                        </div>
                      </div>
                      <ChevronRight style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <FormDrawer
        open={editDrawerOpen}
        title="编辑部门"
        onCancel={() => setEditDrawerOpen(false)}
        onOk={() => setEditDrawerOpen(false)}
      >
        <FormSection title="部门信息" desc="部门基本资料">
          <Field label="部门名称" required>
            <TextInput defaultValue="技术中心" />
          </Field>
          <Field label="负责人">
            <TextInput defaultValue="王磊" />
          </Field>
          <Field label="人员编制">
            <TextInput type="number" defaultValue={35} min={1} />
          </Field>
          <Field label="描述">
            <TextArea placeholder="部门职责描述..." rows={3} defaultValue="负责平台后端架构、前端开发、AI 研究与运维保障" />
          </Field>
        </FormSection>
      </FormDrawer>
    </>
  );
}
