import { Outlet } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import OntologyDomainShell from '../shell/OntologyDomainShell';
import OntologySideNav from './OntologySideNav';
import OntologyContextBar from './OntologyContextBar';
import './workspace.css';

/**
 * 本体建设工作区（ADR-0069 2026-10-08）；保留布局文件名以兼容路由引用。
 * DomainShell 仍包裹全部页面，负责 ADR-0065 的路由/打开记录上下文。
 */
export default function OntologyTabLayout() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setNavOpen(false), [location.pathname, location.search]);
  return (
    <div className="mp-page-full mp-onto-workspace" data-nav-open={navOpen}
      onKeyDown={event => {
        if (event.key === 'Escape' && navOpen) {
          setNavOpen(false);
          toggleRef.current?.focus();
        }
      }}>
      <OntologySideNav onNavigate={() => setNavOpen(false)} />
      <div className="mp-onto-workspace-main">
        <OntologyContextBar navOpen={navOpen} onToggleNav={() => setNavOpen(open => !open)} toggleRef={toggleRef} />
        <div className="mp-onto-workspace-content">
          <OntologyDomainShell><Outlet /></OntologyDomainShell>
        </div>
      </div>
    </div>
  );
}
