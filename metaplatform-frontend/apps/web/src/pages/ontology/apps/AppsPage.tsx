import { Suspense, lazy, useState } from 'react';
import { Tabs } from '@douyinfe/semi-ui';
import { PageHeader } from '@/components/skeleton';
import '../ontology.css';

/**
 * 分析应用（DESIGN-SPEC §5 版式 E 的容器形态）。
 * L6 应用层三件套共享一条产线：分析工作台创建图表 → Pin 到仪表盘 → 地图做地理探索。
 *
 * 2026-09-17：原先藏在「运维 → 更多运维工具 → 分析应用」三层下拉里，提升为一级 tab。
 * 三个子页全部懒加载（非首屏），按需挂载。
 */
const AnalysisPage = lazy(() => import('../AnalysisPage'));
const DashboardPage = lazy(() => import('../DashboardPage'));
const MapPage = lazy(() => import('../MapPage'));

type AppKey = 'analysis' | 'dashboard' | 'map';

const APP_META: Record<AppKey, { label: string; desc: string }> = {
  analysis: {
    label: '分析工作台',
    desc: '对本体对象做分组聚合与图表探索，结果可 Pin 到仪表盘',
  },
  dashboard: {
    label: '仪表盘',
    desc: '由分析工作台 Pin 的图表组成的看板',
  },
  map: {
    label: '地图',
    desc: '带经纬度属性的对象在地图上的分布',
  },
};

export default function AppsPage() {
  const [app, setApp] = useState<AppKey>('analysis');

  return (
    <>
      <PageHeader title={APP_META[app].label} desc={APP_META[app].desc} />

      <Tabs
        type="button"
        activeKey={app}
        tabList={(Object.keys(APP_META) as AppKey[]).map((k) => ({
          tab: APP_META[k].label,
          itemKey: k,
        }))}
        onChange={(key) => setApp(key as AppKey)}
      />

      <Suspense fallback={<div className="mp-onto-muted mp-p-6">加载中…</div>}>
        {app === 'analysis' ? <AnalysisPage /> : null}
        {app === 'dashboard' ? <DashboardPage /> : null}
        {app === 'map' ? <MapPage /> : null}
      </Suspense>
    </>
  );
}
