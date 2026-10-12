import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Banner, Spin } from '@douyinfe/semi-ui';
import { getAppRuntime } from '@/api/apphub/runtime';
import { resolveShortlink } from '@/api/apphub/shortlink';
import { getApp } from '@/api/apphub/apps';
import type { AppRuntime, FormConfig, RenderNode } from '@/api/apphub/types';
import type { PageDesignerConfig } from '@/api/apphub/pages';
import AppRuntimeLayout from './AppRuntimeLayout';
import OrderReviewRuntime from './OrderReviewRuntime';
import type { OrderBinding } from '@/api/apphub/pages';
import RuntimeForm from './RuntimeForm';
import RuntimePageCmp from './RuntimePage';
import RuntimePlaceholder from './RuntimePlaceholder';
import { flattenLeaves } from './treeUtils';
import '../apps.css';

/**
 * 应用运行时入口（/s/:code）：全屏独立应用壳。
 * 仅解析已发布应用短链；错误与空页面显式显示，不构造演示结果。
 */
export default function AppRuntimePage() {
  const { code } = useParams<{ code: string }>();
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const [appName, setAppName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveShortlink(code || '');
        if (!resolved?.app_id) throw new Error('无效或无权访问的应用短链');
        const appCode = resolved.app_id;

        const rt = await getAppRuntime(appCode);
        if (cancelled) return;
        setRuntime(rt);
        setSelectedKey('');

        // AppRuntime 无 name 字段，额外取 getApp 补应用名（失败则用 app_id 兜底）
        getApp(appCode)
          .then((a) => {
            if (!cancelled) setAppName(a?.name || '');
          })
          .catch(() => {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const tree: RenderNode[] = runtime?.render_tree ?? [];
  const leaves = useMemo(() => flattenLeaves(tree), [tree]);
  const current = leaves.find((n) => n.key === selectedKey) || leaves[0];

  const renderContent = (node: RenderNode) => {
    if (node.config?.binding) return <OrderReviewRuntime appId={runtime!.app_id} pageId={String(node.config.page_id)} binding={node.config.binding as OrderBinding} />;
    switch (node.node_type) {
      case 'form':
        return <RuntimeForm config={node.config as unknown as FormConfig} />;
      case 'page':
        return <RuntimePageCmp config={node.config as unknown as PageDesignerConfig} />;
      case 'board':
        return (node.config as { widgets?: unknown[] })?.widgets?.length ? (
          <RuntimePageCmp config={node.config as unknown as PageDesignerConfig} />
        ) : (
          <RuntimePlaceholder nodeType={node.node_type} title={node.title} />
        );
      case 'flow':
      default:
        return <RuntimePlaceholder nodeType={node.node_type} title={node.title} />;
    }
  };

  if (loading) return <Spin size="large" className="mp-block mp-app-spin-center" />;
  if (error) return <Banner type="danger" description={error} className="mp-m-6" />;
  if (!current) return <Banner type="info" description="该应用暂无可用页面" className="mp-m-6" />;

  return (
    <AppRuntimeLayout
      appName={appName || runtime?.app_id || '应用'}
      version={runtime?.version}
      tree={tree}
      selectedKey={current.key}
      onSelect={setSelectedKey}
      isDemo={false}
    >
      {renderContent(current.node)}
    </AppRuntimeLayout>
  );
}
