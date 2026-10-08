import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { resolveWorkspaceNavigation } from './domains';

/** One workspace navigation for every product; resources keep their own detail tabs inside. */
export default function WorkspaceNavigation({ children }: { children: ReactNode }) {
  const location = useLocation();
  const match = resolveWorkspaceNavigation(location.pathname);
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const navHadFocusRef = useRef(false);
  const navOpenRef = useRef(navOpen);
  navOpenRef.current = navOpen;
  const closeNav = () => {
    setNavOpen(false);
    if (navOpen) toggleRef.current?.focus();
  };
  useEffect(() => {
    // History changes also close the menu. Focus returns only if it was inside that menu.
    // A group change removes its links before this effect. Remember where focus was before removal.
    if (navOpenRef.current && navHadFocusRef.current) toggleRef.current?.focus();
    setNavOpen(false);
  }, [location.pathname, location.search, location.hash]);
  useEffect(() => {
    if (navOpen) navRef.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus();
  }, [navOpen]);
  if (!match) return <div className="mp-page">{children}</div>;
  const { domain, groups, group, page } = match;
  const ontology = domain.key === 'ontology';
  const navId = ontology ? 'ontology-workspace-nav' : 'workspace-page-nav';
  const toggleLabel = ontology ? '本体导航' : '页面导航';
  return <div className="mp-workspace" data-nav-open={navOpen} onKeyDown={event => {
    if (event.key === 'Escape' && navOpen) { event.preventDefault(); closeNav(); }
  }}>
    <div className="mp-workspace-groupbar">
      <button ref={toggleRef} type="button" className="mp-workspace-nav-toggle" onClick={() => setNavOpen(open => !open)}
        aria-label={`${navOpen ? '收起' : '展开'}${toggleLabel}`} aria-expanded={navOpen} aria-controls={navId}>
        {navOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <nav className="mp-workspace-groups" aria-label="工作区功能组">
        {groups.map(item => <Link key={item.key} to={item.path} onClick={closeNav}
          aria-current={group?.key === item.key ? 'true' : undefined}>{item.label}</Link>)}
      </nav>
    </div>
    <div className="mp-workspace-body">
      <nav ref={navRef} id={navId} className="mp-workspace-pages" aria-label={ontology ? '本体工作区导航' : '工作区页面导航'}
        onFocus={() => { navHadFocusRef.current = true; }}
        onBlur={event => { navHadFocusRef.current = event.currentTarget.contains(event.relatedTarget); }}>
        <div className="mp-workspace-pages-head"><strong>{domain.label}</strong><span>{group?.label ?? '选择功能组'}</span></div>
        <ul>{group?.pages.map(item => <li key={item.key}><Link to={item.path} onClick={closeNav}
          aria-current={page?.key === item.key ? 'page' : undefined}>{item.label}</Link></li>)}</ul>
      </nav>
      <div className="mp-page">{children}</div>
    </div>
  </div>;
}
