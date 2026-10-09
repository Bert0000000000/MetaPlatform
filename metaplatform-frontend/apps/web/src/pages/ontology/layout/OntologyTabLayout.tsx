import { Navigate, Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import OntologyDomainShell from '../shell/OntologyDomainShell';
import { resolveOntologyNav } from '../navigation';

/** Existing model-check deep link uses the same validation resource and retains route context. */
export function ModelValidationAliasRoute() {
  const location = useLocation();
  const target = resolveOntologyNav(location.pathname)!.item!.path!;
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

/**
 * 本体建设工作区（ADR-0069 2026-10-08）；保留布局文件名以兼容路由引用。
 * DomainShell 仍包裹全部页面，负责 ADR-0065 的路由/打开记录上下文。
 */
export default function OntologyTabLayout() {
  // The platform now owns groups/pages once; preserve the real ontology height/context boundary.
  return <OntologyDomainShell><Outlet /></OntologyDomainShell>;
}
