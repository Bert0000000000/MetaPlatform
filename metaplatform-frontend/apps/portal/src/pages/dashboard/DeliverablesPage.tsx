import { useLocation } from 'react-router-dom';
import {
  Upload,
  Search,
  FileText,
  BarChart3,
  BrainCircuit,
  FileSpreadsheet,
  Database,
  Activity,
  Eye,
  Download,
  Trash2,
  Bot,
  User,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';
import { MOCK_DELIVERABLES } from '@/mock'; // MOCK

const DASHBOARD_TABS = [
  { label: '工作台', path: '/dashboard' },
  { label: '我的应用', path: '/dashboard/my-apps' },
  { label: '我的数字员工', path: '/dashboard/my-agents' },
  { label: '消息', path: '/dashboard/messages' },
  { label: '门户', path: '/dashboard/portal' },
  { label: '交付材料', path: '/dashboard/deliverables' },
];

// MOCK: deliverables table data
const deliverables = [
  { name: 'Q2 架构评审报告', typeLabel: '报告', typeClass: 'v-badge-neutral', project: 'Q2 架构评审', genIcon: Bot, genClass: 'ai', genName: '分析助手', format: 'PDF', size: '2.4 MB', date: '2026-07-18 14:30', status: '已发布', statusClass: 'v-badge-success', icon: FileText },
  { name: '客户行为数据集 v3', typeLabel: '数据集', typeClass: 'v-badge-info', project: '客户分析平台', genIcon: Bot, genClass: 'ai', genName: '数据管家', format: 'XLSX', size: '18.7 MB', date: '2026-07-17 09:15', status: '审核中', statusClass: 'v-badge-warning', icon: BarChart3 },
  { name: '意图分类模型 v2.1', typeLabel: '模型', typeClass: 'v-badge-warning', project: 'Agent 效能评估', genIcon: Bot, genClass: 'ai', genName: '模型训练师', format: '-', size: '142 MB', date: '2026-07-16 16:42', status: '已发布', statusClass: 'v-badge-success', icon: BrainCircuit },
  { name: '数据治理月度汇总', typeLabel: '文档', typeClass: 'v-badge-neutral', project: '数据治理专项', genIcon: User, genClass: 'human', genName: '张明', format: 'DOCX', size: '1.8 MB', date: '2026-07-15 11:08', status: '已发布', statusClass: 'v-badge-success', icon: FileSpreadsheet },
  { name: '知识库质量评估报告', typeLabel: '报告', typeClass: 'v-badge-neutral', project: '知识库建设', genIcon: Bot, genClass: 'ai', genName: '质检专员', format: 'PDF', size: '3.1 MB', date: '2026-07-14 10:22', status: '审核中', statusClass: 'v-badge-warning', icon: Database },
  { name: 'Agent 效果评估报告', typeLabel: '报告', typeClass: 'v-badge-neutral', project: 'Agent 效能评估', genIcon: Bot, genClass: 'ai', genName: '评估助手', format: 'PDF', size: '1.2 MB', date: '2026-07-12 15:37', status: '已发布', statusClass: 'v-badge-success', icon: FileText },
  { name: '系统运维周报 W28', typeLabel: '文档', typeClass: 'v-badge-info', project: 'Q2 架构评审', genIcon: User, genClass: 'human', genName: '李工', format: 'DOCX', size: '0.8 MB', date: '2026-07-11 08:50', status: '草稿', statusClass: 'v-badge-neutral', icon: Activity },
  { name: '用户留存分析数据集', typeLabel: '数据集', typeClass: 'v-badge-info', project: '客户分析平台', genIcon: Bot, genClass: 'ai', genName: '数据管家', format: 'XLSX', size: '9.4 MB', date: '2026-07-10 17:05', status: '审核中', statusClass: 'v-badge-warning', icon: BarChart3 },
];

// MOCK: timeline data
const timelineItems = [
  { title: 'Q2 架构评审报告 已发布', time: '14:30', user: '分析助手', desc: '完成了报告生成，已自动归档至 Q2 架构评审项目。' },
  { title: '客户行为数据集 v3 待审核', time: '09:15', user: '数据管家', desc: '提交了新版数据集，包含 28 万条新增记录，等待人工审核。' },
  { title: '意图分类模型 v2.1 已发布', time: '昨日 16:42', user: '模型训练师', desc: '完成精调训练，F1 提升 4.2%，已部署至 LLM Gateway。' },
  { title: '知识库质量评估报告 待审核', time: '昨日 10:22', user: '质检专员', desc: '识别出 17 处知识冲突，建议人工介入修正。' },
  { title: '数据治理月度汇总 已提交', time: '2 天前', user: '张明', desc: '完成了 7 月份治理数据汇总，新增 5 项规范变更记录。' },
];

const badgeBgMap: Record<string, string> = {
  'v-badge-success': 'var(--success-subtle)',
  'v-badge-warning': 'var(--warning-subtle)',
  'v-badge-neutral': 'var(--muted)',
  'v-badge-info': 'rgba(96,165,250,0.12)',
};
const badgeColorMap: Record<string, string> = {
  'v-badge-success': 'var(--success)',
  'v-badge-warning': 'var(--warning)',
  'v-badge-neutral': 'var(--muted-foreground)',
  'v-badge-info': '#60a5fa',
};

export default function DeliverablesPage() {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={DASHBOARD_TABS} activePath={location.pathname} />

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.01em' }}>交付材料</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>报告、任务输出和分析结果归档</p>
        </div>
        <button className="v-btn v-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Upload style={{ width: 14, height: 14 }} />
          <span>上传材料</span>
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>交付物</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>89</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>累计产出</div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>本月新增</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>12</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--success)' }}>+3</span> 较上月
          </div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>待审核</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>3</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>需处理</div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>已归档</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>76</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>归档率 85%</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 13, fontFamily: 'var(--font-sans)', padding: '0 12px', height: 36, appearance: 'none', cursor: 'pointer', outline: 'none' }}>
          <option>全部类型</option>
          <option>报告</option>
          <option>文档</option>
          <option>数据集</option>
          <option>模型</option>
        </select>
        <select style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 13, fontFamily: 'var(--font-sans)', padding: '0 12px', height: 36, appearance: 'none', cursor: 'pointer', outline: 'none' }}>
          <option>全部时间</option>
          <option>最近 7 天</option>
          <option>最近 30 天</option>
          <option>最近 90 天</option>
          <option>自定义范围</option>
        </select>
        <select style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 13, fontFamily: 'var(--font-sans)', padding: '0 12px', height: 36, appearance: 'none', cursor: 'pointer', outline: 'none' }}>
          <option>全部项目</option>
          <option>Q2 架构评审</option>
          <option>客户分析平台</option>
          <option>Agent 效能评估</option>
          <option>数据治理专项</option>
          <option>知识库建设</option>
        </select>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
          <input className="v-input" type="text" placeholder="搜索交付物名称..." style={{ paddingLeft: 32, width: 220 }} />
        </div>
        <button className="v-btn v-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Upload style={{ width: 14, height: 14 }} />
          <span>上传</span>
        </button>
      </div>

      {/* Content: table + timeline */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Main table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <table style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['名称', '类型', '关联项目', '生成者', '格式', '大小', '创建时间', '状态', '操作'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliverables.map((d, i) => {
                const DocIcon = d.icon;
                const GenIcon = d.genIcon;
                return (
                  <tr key={i}>
                    <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <DocIcon style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                        </div>
                        <span>{d.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 500, display: 'inline-block', whiteSpace: 'nowrap', background: badgeBgMap[d.typeClass], color: badgeColorMap[d.typeClass] }}>{d.typeLabel}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span className="v-meta">{d.project}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: d.genClass === 'ai' ? '#60a5fa' : 'var(--success)' }}>
                        <GenIcon style={{ width: 12, height: 12 }} />
                        {d.genName}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{d.format}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span className="v-meta">{d.size}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span className="v-meta">{d.date}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 500, display: 'inline-block', whiteSpace: 'nowrap', background: badgeBgMap[d.statusClass], color: badgeColorMap[d.statusClass] }}>{d.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a style={{ fontSize: 13, color: 'var(--muted-foreground)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Eye style={{ width: 14, height: 14 }} />
                        </a>
                        <a style={{ fontSize: 13, color: 'var(--muted-foreground)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Download style={{ width: 14, height: 14 }} />
                        </a>
                        <a style={{ fontSize: 13, color: 'var(--muted-foreground)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Table footer / pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>共 89 条，当前显示 1-8 条</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['1', '2', '3', '...', '12'].map((p, i) => (
                <button key={i} style={{
                  background: p === '1' ? 'var(--primary)' : 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: p === '1' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  fontSize: 12, fontFamily: 'var(--font-sans)', padding: '4px 10px', cursor: 'pointer',
                  borderColor: p === '1' ? 'var(--primary)' : 'var(--border)',
                }}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar: Recent activity timeline */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, letterSpacing: '-0.01em' }}>近期动态</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {timelineItems.map((item, i) => (
              <div key={i} style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
                padding: '14px 16px', marginBottom: 8, position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.time}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{item.user}</span> {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
