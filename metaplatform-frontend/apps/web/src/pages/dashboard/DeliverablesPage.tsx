import { useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  Upload, Search, FileText, BarChart3, BrainCircuit, FileSpreadsheet,
  Database, Activity, Eye, Download, Trash2, Bot, User, type LucideIcon,
} from 'lucide-react';
import { getDeliverablesSummary, type DeliverableItem, type DeliverableTimelineItem } from '@/api/dashboard/workbench';


const DELIVERABLE_ICON_MAP: Record<string, LucideIcon> = {
  FileText, BarChart3, BrainCircuit, FileSpreadsheet, Database, Activity,
};
const getDeliverableIcon = (name: string): LucideIcon => DELIVERABLE_ICON_MAP[name] ?? FileText;

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

const FALLBACK_DELIVERABLES: DeliverableItem[] = [
  { name: 'Q2 架构评审报告', type_label: '报告', type_class: 'v-badge-neutral', project: 'Q2 架构评审', gen_class: 'ai', gen_name: '分析助手', format: 'PDF', size: '2.4 MB', date: '2026-07-18 14:30', status: '已发布', status_class: 'v-badge-success', icon: 'FileText' },
  { name: '客户行为数据集 v3', type_label: '数据集', type_class: 'v-badge-info', project: '客户分析平台', gen_class: 'ai', gen_name: '数据管家', format: 'XLSX', size: '18.7 MB', date: '2026-07-17 09:15', status: '审核中', status_class: 'v-badge-warning', icon: 'BarChart3' },
  { name: '意图分类模型 v2.1', type_label: '模型', type_class: 'v-badge-warning', project: 'Agent 效能评估', gen_class: 'ai', gen_name: '模型训练师', format: '-', size: '142 MB', date: '2026-07-16 16:42', status: '已发布', status_class: 'v-badge-success', icon: 'BrainCircuit' },
  { name: '数据治理月度汇总', type_label: '文档', type_class: 'v-badge-neutral', project: '数据治理专项', gen_class: 'human', gen_name: '张明', format: 'DOCX', size: '1.8 MB', date: '2026-07-15 11:08', status: '已发布', status_class: 'v-badge-success', icon: 'FileSpreadsheet' },
  { name: '知识库质量评估报告', type_label: '报告', type_class: 'v-badge-neutral', project: '知识库建设', gen_class: 'ai', gen_name: '质检专员', format: 'PDF', size: '3.1 MB', date: '2026-07-14 10:22', status: '审核中', status_class: 'v-badge-warning', icon: 'Database' },
  { name: 'Agent 效果评估报告', type_label: '报告', type_class: 'v-badge-neutral', project: 'Agent 效能评估', gen_class: 'ai', gen_name: '评估助手', format: 'PDF', size: '1.2 MB', date: '2026-07-12 15:37', status: '已发布', status_class: 'v-badge-success', icon: 'FileText' },
  { name: '系统运维周报 W28', type_label: '文档', type_class: 'v-badge-info', project: 'Q2 架构评审', gen_class: 'human', gen_name: '李工', format: 'DOCX', size: '0.8 MB', date: '2026-07-11 08:50', status: '草稿', status_class: 'v-badge-neutral', icon: 'Activity' },
  { name: '用户留存分析数据集', type_label: '数据集', type_class: 'v-badge-info', project: '客户分析平台', gen_class: 'ai', gen_name: '数据管家', format: 'XLSX', size: '9.4 MB', date: '2026-07-10 17:05', status: '审核中', status_class: 'v-badge-warning', icon: 'BarChart3' },
];

const FALLBACK_TIMELINE_ITEMS: DeliverableTimelineItem[] = [
  { time_label: '07-22 14:30', title: 'Q2 架构评审报告 已发布', description: '完成了报告生成，已自动归档至 Q2 架构评审项目。', icon: 'FileText' },
  { time_label: '07-22 09:15', title: '客户行为数据集 v3 待审核', description: '提交了新版数据集，包含 28 万条新增记录，等待人工审核。', icon: 'BarChart3' },
  { time_label: '07-21 16:42', title: '意图分类模型 v2.1 已发布', description: '完成精调训练，F1 提升 4.2%，已部署至 LLM Gateway。', icon: 'BrainCircuit' },
  { time_label: '07-21 10:22', title: '知识库质量评估报告 待审核', description: '识别出 17 处知识冲突，建议人工介入修正。', icon: 'Database' },
  { time_label: '07-20 09:08', title: '数据治理月度汇总 已提交', description: '完成了 7 月份治理数据汇总，新增 5 项规范变更记录。', icon: 'FileSpreadsheet' },
];

const SkeletonLine: React.FC<{ width?: string; height?: string; style?: React.CSSProperties }> = ({ width = '100%', height = '14px', style }) => (
  <div style={{
    width, height,
    background: 'linear-gradient(90deg, var(--muted) 0%, var(--border) 50%, var(--muted) 100%)',
    backgroundSize: '200% 100%',
    animation: 'workbench-shimmer 1.4s ease-in-out infinite',
    borderRadius: 4, ...style,
  }} />
);

export default function DeliverablesPage() {
  
  // 数据状态
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>(FALLBACK_DELIVERABLES);
  const [timeline, setTimeline] = useState<DeliverableTimelineItem[]>(FALLBACK_TIMELINE_ITEMS);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDeliverablesSummary()
      .then((res) => {
        if (cancelled) return;
        setDeliverables(res.deliverables ?? []);
        setTimeline(res.timeline ?? []);
        setSource('api');
      })
      .catch(() => {
        if (cancelled) return;
        setSource('fallback');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 派生数据：stats
  const totalCount = deliverables.length;
  const publishedCount = useMemo(() => deliverables.filter(d => d.status === '已发布').length, [deliverables]);
  const pendingCount = useMemo(() => deliverables.filter(d => d.status === '审核中').length, [deliverables]);
  const archiveRate = totalCount > 0 ? Math.round((publishedCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.01em' }}>交付材料</h1>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>报告、任务输出和分析结果归档</p>
            </div>
            {source === 'fallback' && !loading && (
              <span title="API 不可达，使用本地兜底数据" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>本地数据</span>
            )}
          </div>
          <button className="v-btn v-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Upload style={{ width: 14, height: 14 }} />
            <span>上传材料</span>
          </button>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>本月</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>{totalCount}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>累计产出</div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>发布</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>{publishedCount}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--success)' }}>+3</span> 较上月
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>待审</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>{pendingCount}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>需处理</div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>归档</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>{archiveRate}%</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>归档率</div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 13, height: 32, padding: '0 12px' }}>
            <option>全部类型</option>
            <option>报告</option>
            <option>文档</option>
            <option>数据集</option>
            <option>模型</option>
          </select>
          <select style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--foreground)', fontSize: 13, height: 32, padding: '0 12px' }}>
            <option>全部时间</option>
            <option>最近 7 天</option>
            <option>最近 30 天</option>
          </select>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <input type="text" placeholder="搜索交付材料..." style={{ width: '100%', height: 32, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 16px 0 40px', fontSize: 13, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>名称</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>类型</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>项目</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>生成方</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>格式</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>大小</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>更新时间</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>状态</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}><SkeletonLine width="80%" height="12px" /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="40px" height="18px" style={{ borderRadius: 4 }} /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="70%" height="12px" /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="50px" height="12px" /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="30px" height="12px" /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="50px" height="12px" /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="60%" height="12px" /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="50px" height="18px" style={{ borderRadius: 4 }} /></td>
                      <td style={{ padding: '12px' }}><SkeletonLine width="60px" height="20px" style={{ borderRadius: 4 }} /></td>
                    </tr>
                  ))
                : deliverables.length === 0
                  ? <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无交付材料</td></tr>
                  : deliverables.map((d, i) => {
                      const Icon = getDeliverableIcon(d.icon);
                      const GenIcon = d.gen_class === 'ai' ? Bot : User;
                      return (
                        <tr key={d.name + i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontSize: 13, fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Icon style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                              <span>{d.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span className={`v-badge ${d.type_class}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block', background: badgeBgMap[d.type_class], color: badgeColorMap[d.type_class] }}>{d.type_label}</span>
                          </td>
                          <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted-foreground)' }}>{d.project}</td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <GenIcon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                              <span>{d.gen_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{d.format}</td>
                          <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted-foreground)' }}>{d.size}</td>
                          <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted-foreground)' }}>{d.date}</td>
                          <td style={{ padding: '12px' }}>
                            <span className={`v-badge ${d.status_class}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block', background: badgeBgMap[d.status_class] ?? 'var(--muted)', color: badgeColorMap[d.status_class] ?? 'var(--muted-foreground)' }}>{d.status}</span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button title="查看" style={{ width: 28, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted-foreground)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Eye style={{ width: 14, height: 14 }} />
                              </button>
                              <button title="下载" style={{ width: 28, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted-foreground)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Download style={{ width: 14, height: 14 }} />
                              </button>
                              <button title="删除" style={{ width: 28, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--destructive)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>

        {/* Timeline */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>近期动态</h2>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 1, background: 'var(--border)' }} />
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ position: 'relative', paddingBottom: 16 }}>
                    <div style={{ position: 'absolute', left: -20, top: 4, width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--border)', background: 'var(--card)' }} />
                    <SkeletonLine width="30%" height="11px" style={{ marginBottom: 4 }} />
                    <SkeletonLine width="80%" height="12px" />
                  </div>
                ))
              : timeline.length === 0
                ? <div style={{ padding: 20, color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center' }}>暂无动态</div>
                : timeline.map((t, i) => {
                    const Icon = getDeliverableIcon(t.icon);
                    return (
                      <div key={t.time_label + i} style={{ position: 'relative', paddingBottom: 16 }}>
                        <div style={{
                          position: 'absolute', left: -20, top: 4, width: 11, height: 11, borderRadius: '50%',
                          border: '2px solid var(--border)',
                          borderColor: i === 0 ? '#60a5fa' : 'var(--border)',
                          background: i === 0 ? '#60a5fa' : 'var(--card)',
                        }} />
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>{t.time_label}</div>
                        <div style={{ fontSize: 13, color: 'var(--card-foreground)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                          <strong>{t.title}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2, lineHeight: 1.5 }}>{t.description}</div>
                      </div>
                    );
                  })}
          </div>
        </div>
      </div>
    </div>
  );
}