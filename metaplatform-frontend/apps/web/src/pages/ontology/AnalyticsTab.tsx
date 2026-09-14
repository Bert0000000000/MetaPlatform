// AnalyticsTab —— "分析应用" tab 的子导航（分析工作台/仪表盘/地图三合一）。
// L6 应用层三件套（Palantir Quiver / Carbon / Map 对位）共享一条产线：
// 分析工作台创建图表 → Pin 到仪表盘 → 地图做地理探索。
// 三个子页全部懒加载（非首屏），按需挂载。

import { Suspense, lazy, useState, type CSSProperties } from 'react';

const AnalysisPage = lazy(() => import('./AnalysisPage'));
const DashboardPage = lazy(() => import('./DashboardPage'));
const MapPage = lazy(() => import('./MapPage'));

const LAZY_FALLBACK = (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--muted-foreground)', fontSize: 13 }}>
    加载中…
  </div>
);

type SubKey = 'analysis' | 'dashboard' | 'map';

const SUB_LABELS: Record<SubKey, string> = {
  analysis: '分析工作台',
  dashboard: '仪表盘',
  map: '地图',
};

const SUB_KEYS = Object.keys(SUB_LABELS) as SubKey[];

const BTN_BASE: CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export interface AnalyticsTabProps {
  initialSub?: string;
}

function normalizeSub(raw: string | undefined): SubKey {
  return SUB_KEYS.includes(raw as SubKey) ? (raw as SubKey) : 'analysis';
}

export default function AnalyticsTab({ initialSub }: AnalyticsTabProps) {
  const [sub, setSub] = useState<SubKey>(normalizeSub(initialSub));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        {SUB_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            style={{
              ...BTN_BASE,
              background: sub === k ? 'var(--foreground)' : 'var(--card)',
              color: sub === k ? 'var(--background)' : 'var(--muted-foreground)',
              fontWeight: sub === k ? 600 : 400,
            }}
          >
            {SUB_LABELS[k]}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {sub === 'analysis' && (
          <Suspense fallback={LAZY_FALLBACK}>
            <AnalysisPage />
          </Suspense>
        )}
        {sub === 'dashboard' && (
          <Suspense fallback={LAZY_FALLBACK}>
            <DashboardPage />
          </Suspense>
        )}
        {sub === 'map' && (
          <Suspense fallback={LAZY_FALLBACK}>
            <MapPage />
          </Suspense>
        )}
      </div>
    </div>
  );
}
