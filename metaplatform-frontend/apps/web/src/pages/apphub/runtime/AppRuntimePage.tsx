import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Banner, Spin } from '@douyinfe/semi-ui';
import { getAppRuntime } from '@/api/apphub/runtime';
import { resolveShortlink } from '@/api/apphub/shortlink';
import { getApp } from '@/api/apphub/apps';
import type { AppRuntime, FormConfig, RenderNode } from '@/api/apphub/types';
import type { PageDesignerConfig } from '@/api/apphub/pages';
import AppRuntimeLayout from './AppRuntimeLayout';
import RuntimeForm from './RuntimeForm';
import RuntimePageCmp from './RuntimePage';
import RuntimePlaceholder from './RuntimePlaceholder';
import { DEMO_RENDER_TREE } from './demoData';
import { flattenLeaves } from './treeUtils';

/**
 * 应用运行时入口（/s/:code）：全屏独立应用壳。
 * code 解析：先尝试 resolveShortlink（短链 → app_id），失败则把 code 当 app code（兼容 /s/kb 直连）。
 * 后端 render_tree 为空时启用内置 demo 数据兜底，保证应用壳可演示与验证。
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
        let appCode = code || '';
        // 短链优先解析；非短链则回退 code 当 app code
        try {
          const resolved = await resolveShortlink(code || '');
          if (resolved?.app_id) appCode = resolved.app_id;
        } catch {
          /* 不是短链，按 app code 处理 */
        }

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

  const useDemo = !runtime?.render_tree?.length;
  const tree: RenderNode[] = useDemo ? DEMO_RENDER_TREE : runtime!.render_tree;
  const leaves = useMemo(() => flattenLeaves(tree), [tree]);
  const current = leaves.find((n) => n.key === selectedKey) || leaves[0];

  const renderContent = (node: RenderNode) => {
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

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
  if (error) return <Banner type="danger" description={error} style={{ margin: 24 }} />;
  if (!current) return <Banner type="info" description="该应用暂无可用页面" style={{ margin: 24 }} />;

  return (
    <AppRuntimeLayout
      appName={appName || runtime?.app_id || '应用'}
      version={runtime?.version}
      tree={tree}
      selectedKey={current.key}
      onSelect={setSelectedKey}
      isDemo={useDemo}
    >
      {renderContent(current.node)}
    </AppRuntimeLayout>
  );
}
