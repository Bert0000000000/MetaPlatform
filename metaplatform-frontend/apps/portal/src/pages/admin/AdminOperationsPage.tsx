import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TrendingUp, TrendingDown, Users, Zap, Grid3x3, Activity, Cpu } from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

const statsCards = [
  { label: '今日 Token 消耗', value: '1.2M', change: '+8.3%', changeLabel: '较昨日', trend: 'up' as const },
  { label: '本月 API 调用', value: '847K', change: '+12.1%', changeLabel: '较上月', trend: 'up' as const },
  { label: '今日 UV', value: '342', change: '-2.4%', changeLabel: '较昨日', trend: 'down' as const },
  { label: '今日 PV', value: '2,847', change: '+5.6%', changeLabel: '较昨日', trend: 'up' as const },
  { label: '活跃用户 / 总用户', value: '128', sub: '/ 156', extra: '活跃率', extraValue: '82.1%', extraColor: 'var(--success)' },
  { label: '平均响应时间', value: '230', unit: 'ms', change: '-12ms', changeLabel: '较昨日', trend: 'up' as const },
];

const tokenBars = [
  { label: '07/09', height: 58 }, { label: '07/10', height: 72 }, { label: '07/11', height: 45 },
  { label: '07/12', height: 80 }, { label: '07/13', height: 65 }, { label: '07/14', height: 88 },
  { label: '07/15', height: 52 }, { label: '07/16', height: 95 }, { label: '07/17', height: 70 },
  { label: '07/18', height: 60 }, { label: '07/19', height: 78 }, { label: '07/20', height: 85 },
  { label: '07/21', height: 92 }, { label: '07/22', height: 100 },
];

const apiTop10 = [
  { rank: 1, path: '/api/v1/agent/react', calls: '12,847', avg: '145ms', avgColor: 'var(--success)', err: 0.5, errColor: 'var(--success)' },
  { rank: 2, path: '/api/v1/ont/concept/query', calls: '9,623', avg: '89ms', avgColor: 'var(--success)', err: 0.2, errColor: 'var(--success)' },
  { rank: 3, path: '/api/v1/llm/chat', calls: '8,412', avg: '312ms', avgColor: 'var(--warning)', err: 1.8, errColor: 'var(--warning)' },
  { rank: 4, path: '/api/v1/rag/retrieve', calls: '7,205', avg: '178ms', avgColor: 'var(--success)', err: 0.8, errColor: 'var(--success)' },
  { rank: 5, path: '/api/v1/mcp/tools/list', calls: '5,891', avg: '56ms', avgColor: 'var(--success)', err: 0.1, errColor: 'var(--success)' },
  { rank: 6, path: '/api/v1/wfe/instance/list', calls: '4,320', avg: '124ms', avgColor: 'var(--success)', err: 0.3, errColor: 'var(--success)' },
  { rank: 7, path: '/api/v1/ont/graph/traverse', calls: '3,876', avg: '267ms', avgColor: 'var(--warning)', err: 1.2, errColor: 'var(--warning)' },
  { rank: 8, path: '/api/v1/a2a/agent/discover', calls: '2,945', avg: '198ms', avgColor: 'var(--success)', err: 0.6, errColor: 'var(--success)' },
  { rank: 9, path: '/api/v1/data/etl/execute', calls: '2,134', avg: '623ms', avgColor: 'var(--destructive)', err: 4.2, errColor: 'var(--destructive)' },
  { rank: 10, path: '/api/v1/iam/auth/token', calls: '1,890', avg: '42ms', avgColor: 'var(--success)', err: 0.9, errColor: 'var(--success)' },
];

const heatmapModules = [
  { name: '工作台', color: '96,165,250', data: [342, 410, 298, 445, 378, 120, 68] },
  { name: 'SuperAI', color: '168,85,247', data: [567, 420, 612, 489, 534, 178, 95] },
  { name: '应用中心', color: '234,179,8', data: [234, 312, 198, 356, 289, 78, 34] },
  { name: '本体引擎', color: '98,209,120', data: [189, 245, 156, 278, 210, 89, 42] },
  { name: 'MCP', color: '244,114,182', data: [312, 234, 378, 289, 345, 112, 56] },
  { name: '数字员工', color: '251,146,60', data: [423, 345, 467, 398, 512, 145, 78] },
];

const dauMau = {
  dau: [{ x: 8.33, y: 54.2 }, { x: 25, y: 45.8 }, { x: 41.67, y: 62.5 }, { x: 58.33, y: 37.5 }, { x: 75, y: 50 }, { x: 91.67, y: 41.7 }, { x: 100, y: 35.4 }],
  mau: [{ x: 8.33, y: 16.7 }, { x: 25, y: 14.6 }, { x: 41.67, y: 12.5 }, { x: 58.33, y: 12.5 }, { x: 75, y: 10.4 }, { x: 91.67, y: 8.3 }, { x: 100, y: 8.3 }],
  xLabels: ['07/16', '07/17', '07/18', '07/19', '07/20', '07/21', '07/22'],
  yLabels: ['0', '80', '160', '240'],
};

const retention = [
  { metric: '次日留存', current: 78.4, prev: 75.2, color: 'var(--success)' },
  { metric: '3 日留存', current: 62.1, prev: 58.7, color: 'var(--info)' },
  { metric: '7 日留存', current: 45.3, prev: 44.8, color: 'var(--warning)' },
  { metric: '30 日留存', current: 28.6, prev: 30.1, color: 'var(--destructive)' },
];

const realtimeLogs = [
  { time: '14:32:08', path: '/api/v1/agent/react', code: 200, codeColor: 'var(--success)', dur: '142ms' },
  { time: '14:32:07', path: '/api/v1/ont/concept/query', code: 200, codeColor: 'var(--success)', dur: '78ms' },
  { time: '14:32:05', path: '/api/v1/rag/retrieve', code: 200, codeColor: 'var(--success)', dur: '195ms' },
  { time: '14:32:03', path: '/api/v1/llm/chat', code: 429, codeColor: 'var(--warning)', dur: '--' },
  { time: '14:32:01', path: '/api/v1/mcp/tools/list', code: 200, codeColor: 'var(--success)', dur: '34ms' },
];

const resources = [
  { label: 'CPU 使用率', value: 34, detail: '16 核 / 48 核', type: 'ring', color: 'var(--success)' },
  { label: '内存使用率', value: 67, detail: '85.8GB / 128GB', type: 'ring', color: 'var(--warning)' },
  { label: '磁盘', value: 24, detail: '2.4TB / 10TB', type: 'bar', color: 'var(--info)' },
  { label: '网络带宽', value: 42, detail: '420Mbps / 1Gbps', type: 'bar', color: 'var(--info)' },
];

function HeatmapRow({ name, color, data }: { name: string; color: string; data: number[] }) {
  const max = Math.max(...data);
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', paddingRight: 12, whiteSpace: 'nowrap' }}>{name}</div>
      {data.map((v, i) => {
        const opacity = 0.15 + (v / max) * 0.85;
        return (
          <div key={i} style={{ height: 36, borderRadius: 3, background: `rgba(${color}, ${opacity})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.85)' }} title={`${name} 周${i + 1}: ${v}`}>{v}</div>
        );
      })}
    </>
  );
}

function Ring({ percent, color }: { percent: number; color: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" style={{ stroke: 'var(--muted)' }} />
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round" style={{ stroke: color, strokeDasharray: c, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

export default function AdminOperationsPage() {
  const location = useLocation();
  const [chartRange, setChartRange] = useState<'day' | 'week' | 'month'>('week');

  const buildLinePoints = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x}%,${p.y}%`).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>运营数据</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>平台运营指标实时监控与数据分析</p>
        </div>

        {/* 1. Stats Cards (2x3) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {statsCards.map((s, i) => (
            <div key={i} className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 500 }}>{s.label}</span>
              <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: s.unit ? 'var(--font-mono)' : undefined }}>
                {s.value}
                {s.sub && <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted-foreground)' }}>{s.sub}</span>}
                {s.unit && <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted-foreground)' }}>{s.unit}</span>}
              </span>
              {s.trend && (
                <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: s.trend === 'up' ? 'var(--success)' : 'var(--destructive)' }}>
                  {s.trend === 'up' ? <TrendingUp style={{ width: 14, height: 14 }} /> : <TrendingDown style={{ width: 14, height: 14 }} />}
                  {s.change} {s.changeLabel}
                </span>
              )}
              {s.extra && (
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {s.extra} <span style={{ color: s.extraColor, fontWeight: 500 }}>{s.extraValue}</span>
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 2. Token Trend（整行宽度） */}
        <div className="v-card" style={{ display: 'flex', flexDirection: 'row', padding: '20px', gap: 24, marginBottom: 16, alignItems: 'stretch' }}>
          {/* 左侧：标题 + 摘要 + 筛选器（占 1/4） */}
          <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Token 消耗趋势</span>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>最近 14 天</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>1.2M</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>本周累计</div>
              <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)', marginTop: 6 }}>
                <TrendingUp style={{ width: 12, height: 12 }} />
                +8.3%
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(['day', 'week', 'month'] as const).map((r) => (
                <button key={r} onClick={() => setChartRange(r)} style={{ padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', textAlign: 'left', color: chartRange === r ? 'var(--foreground)' : 'var(--muted-foreground)', background: chartRange === r ? 'var(--muted)' : 'transparent', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)' }}>
                  {r === 'day' ? '今日' : r === 'week' ? '本周' : '本月'}
                </button>
              ))}
            </div>
          </div>
          {/* 右侧：横向柱状图（占 3/4，整行宽） */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 180, paddingLeft: 44 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 24, width: 40, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between' }}>
                {['1.2M', '800K', '400K', '0'].map((y) => (
                  <span key={y} style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', textAlign: 'right', paddingRight: 8, lineHeight: 1 }}>{y}</span>
                ))}
              </div>
              <div style={{ position: 'absolute', left: 44, right: 0, top: 0, bottom: 24, display: 'flex', alignItems: 'flex-end', gap: 6, padding: '0 4px' }}>
                {tokenBars.map((b, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ width: '100%', maxWidth: 40, borderRadius: '3px 3px 0 0', height: `${b.height}%`, background: b.height === 100 ? 'var(--primary)' : 'var(--success)' }} title={`${b.label}: ${b.height}%`} />
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', left: 44, right: 0, bottom: 0, height: 24, display: 'flex', gap: 6, padding: '0 4px' }}>
                {tokenBars.map((b) => (
                  <span key={b.label} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', lineHeight: '24px', maxWidth: 40 }}>{b.label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Module Heatmap（位于 API Top 10 之上） */}
        <div className="v-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Grid3x3 style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />模块使用热力图（本周）
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 3 }}>
            <div></div>
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((d) => (
              <div key={d} style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500 }}>{d}</div>
            ))}
            {heatmapModules.map((m) => (
              <HeatmapRow key={m.name} name={m.name} color={m.color} data={m.data} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>低</span>
            <div style={{ width: 120, height: 12, borderRadius: 2, display: 'flex', overflow: 'hidden' }}>
              {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((o) => (
                <div key={o} style={{ flex: 1, background: `rgba(96,165,250,${o})` }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>高</span>
          </div>
        </div>

        {/* 4. API Top 10（位于模块热力图之下） */}
        <div className="v-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
          <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>API 调用 Top 10</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>近 24 小时</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: 40 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>API 路径</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: 100 }}>调用次数</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: 120 }}>平均耗时</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: 200 }}>错误率</th>
                </tr>
              </thead>
              <tbody>
                {apiTop10.map((api) => (
                  <tr key={api.rank}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)' }}>{api.rank}</span></td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--info)' }}>{api.path}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{api.calls}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: api.avgColor, fontFamily: 'var(--font-mono)' }}>{api.avg}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-block', verticalAlign: 'middle', width: 120, height: 5, background: 'var(--muted)', borderRadius: 2, overflow: 'hidden', marginRight: 6 }}>
                        <span style={{ display: 'block', height: '100%', borderRadius: 2, width: `${Math.min(100, api.err * 10)}%`, background: api.errColor }} />
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>{api.err}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. User Activity + Realtime */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
          <div className="v-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />用户活跃度
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10, fontWeight: 500 }}>DAU / MAU 趋势（近 7 天）</div>
            <div style={{ position: 'relative', height: 140, paddingLeft: 44, paddingBottom: 28, marginBottom: 20 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 28, width: 40, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between' }}>
                {dauMau.yLabels.map((y) => (
                  <span key={y} style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', textAlign: 'right', paddingRight: 8 }}>{y}</span>
                ))}
              </div>
              <div style={{ position: 'absolute', left: 44, right: 0, top: 0, bottom: 28, overflow: 'hidden' }}>
                {dauMau.dau.map((p, i) => (
                  <span key={`d-${i}`} style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: 'var(--info)', transform: 'translate(-50%, -50%)', left: `${p.x}%`, top: `${p.y}%` }} />
                ))}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={buildLinePoints(dauMau.dau)} />
                </svg>
                {dauMau.mau.map((p, i) => (
                  <span key={`m-${i}`} style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', transform: 'translate(-50%, -50%)', left: `${p.x}%`, top: `${p.y}%` }} />
                ))}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" points={buildLinePoints(dauMau.mau)} />
                </svg>
              </div>
              <div style={{ position: 'absolute', left: 44, right: 0, bottom: 0, height: 28, display: 'flex' }}>
                {dauMau.xLabels.map((l) => (
                  <span key={l} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', lineHeight: '28px' }}>{l}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>
                <span style={{ width: 12, height: 2, background: 'var(--info)', display: 'inline-block', borderRadius: 1 }} /> DAU
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>
                <span style={{ width: 12, height: 2, background: 'var(--warning)', display: 'inline-block', borderRadius: 1, borderTop: '1px dashed var(--warning)' }} /> MAU
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10, fontWeight: 500 }}>用户留存率</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>指标</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>本周</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>上周</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', width: 120 }}>趋势</th>
                </tr>
              </thead>
              <tbody>
                {retention.map((r) => (
                  <tr key={r.metric}>
                    <td style={{ padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{r.metric}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{r.current}%</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}>{r.prev}%</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: '100%', height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                        <div style={{ width: `${r.current}%`, height: '100%', borderRadius: 3, background: r.color }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="v-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />实时监控
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--muted)', borderRadius: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users style={{ width: 16, height: 16 }} />当前在线
                </span>
                <span style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>42</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--muted)', borderRadius: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap style={{ width: 16, height: 16 }} />QPS
                </span>
                <span style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>128</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, fontWeight: 500 }}>最近请求</div>
              {realtimeLogs.map((log, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 60px 60px', gap: 6, padding: '8px 0', fontSize: 12, borderBottom: i === realtimeLogs.length - 1 ? 'none' : '1px solid var(--border)', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{log.time}</span>
                  <span style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.path}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, textAlign: 'center', color: log.codeColor }}>{log.code}</span>
                  <span style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right' }}>{log.dur}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 6. Resource Consumption */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />资源消耗
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {resources.map((r) => (
              <div key={r.label} className="v-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {r.type === 'ring' ? (
                  <>
                    <div style={{ width: 100, height: 100, position: 'relative' }}>
                      <Ring percent={r.value} color={r.color} />
                      <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{r.value}%</span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 500 }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{r.detail}</span>
                  </>
                ) : (
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600 }}>{r.value}%</span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ width: `${r.value}%`, height: '100%', borderRadius: 3, background: r.color }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>{r.detail}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
