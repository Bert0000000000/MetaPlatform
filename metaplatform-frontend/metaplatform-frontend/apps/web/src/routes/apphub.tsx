/** AppHub module routes (apphub + marketplace + designers). */
import { lazy } from 'react';
import { ErrorBoundary } from '@mate/shared';

const ApphubAppListPage = lazy(() => import('../pages/apphub/AppListPage'));
const ApphubAppDetailPage = lazy(() => import('../pages/apphub/AppDetailPage'));
const ApphubAppLifecyclePage = lazy(() => import('../pages/apphub/AppLifecyclePage'));
const ApphubVersionManagementPage = lazy(() => import('../pages/apphub/VersionManagementPage'));
const ApphubReleaseRecordPage = lazy(() => import('../pages/apphub/ReleaseRecordPage'));
const ApphubFormDesignerPage = lazy(() => import('../pages/apphub/FormDesignerPage'));
const ApphubFlowDesignerPage = lazy(() => import('../pages/apphub/FlowDesignerPage'));
const ApphubPageDesignerPage = lazy(() => import('../pages/apphub/PageDesignerPage'));
const ApphubMarketplacePage = lazy(() => import('../pages/apphub/MarketplacePage'));
const ApphubMarketplaceDetailPage = lazy(() => import('../pages/apphub/MarketplaceDetailPage'));
const ApphubMarketPage = lazy(() => import('../pages/apphub/MarketPage'));
const ApphubTemplateDetailPage = lazy(() => import('../pages/apphub/TemplateDetailPage'));
const ApphubMyTemplatesPage = lazy(() => import('../pages/apphub/MyTemplatesPage'));
const ApphubTemplateSubmitPage = lazy(() => import('../pages/apphub/TemplateSubmitPage'));
const ApphubAIDesignerPage = lazy(() => import('../pages/apphub/AIDesignerPage'));

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}

export const apphubRouteElements = {
  ApphubAppListPage: withBoundary('apphub.list', <ApphubAppListPage />),
  ApphubAppDetailPage: withBoundary('apphub.detail', <ApphubAppDetailPage />),
  ApphubAppLifecyclePage: withBoundary('apphub.lifecycle', <ApphubAppLifecyclePage />),
  ApphubVersionManagementPage: withBoundary('apphub.versions', <ApphubVersionManagementPage />),
  ApphubReleaseRecordPage: withBoundary('apphub.release', <ApphubReleaseRecordPage />),
  ApphubFormDesignerPage: withBoundary('apphub.form-designer', <ApphubFormDesignerPage />),
  ApphubFlowDesignerPage: withBoundary('apphub.flow-designer', <ApphubFlowDesignerPage />),
  ApphubPageDesignerPage: withBoundary('apphub.page-designer', <ApphubPageDesignerPage />),
  ApphubMarketplacePage: withBoundary('apphub.marketplace', <ApphubMarketplacePage />),
  ApphubMarketplaceDetailPage: withBoundary('apphub.marketplace.detail', <ApphubMarketplaceDetailPage />),
  ApphubMarketPage: withBoundary('apphub.market', <ApphubMarketPage />),
  ApphubTemplateDetailPage: withBoundary('apphub.template', <ApphubTemplateDetailPage />),
  ApphubMyTemplatesPage: withBoundary('apphub.my-templates', <ApphubMyTemplatesPage />),
  ApphubTemplateSubmitPage: withBoundary('apphub.my-templates.submit', <ApphubTemplateSubmitPage />),
  ApphubAIDesignerPage: withBoundary('apphub.ai-designer', <ApphubAIDesignerPage />),
} as const;
