import type { RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, X } from 'lucide-react';
import { ontologyBreadcrumb, ontologyWorkspaceDefaultPath } from '../navigation';

interface Props {
  navOpen: boolean;
  onToggleNav: () => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
}

export default function OntologyContextBar({ navOpen, onToggleNav, toggleRef }: Props) {
  const { pathname } = useLocation();
  const crumbs = ontologyBreadcrumb(pathname);
  return <div className="mp-onto-contextbar">
    <button type="button" className="mp-onto-nav-toggle" ref={toggleRef} onClick={onToggleNav}
      aria-label={navOpen ? '收起本体导航' : '展开本体导航'} aria-expanded={navOpen}
      aria-controls="ontology-workspace-nav">
      {navOpen ? <X size={18} /> : <Menu size={18} />}
    </button>
    <nav aria-label="本体上下文"><ol className="mp-onto-crumbs">
      <li><Link to={ontologyWorkspaceDefaultPath()}>本体</Link></li>
      {crumbs.map((crumb, index) => <li key={`${crumb.name}-${index}`}>
        <ChevronRight size={13} aria-hidden="true" />
        {crumb.path && index < crumbs.length - 1
          ? <Link to={crumb.path}>{crumb.name}</Link>
          : <span aria-current="page">{crumb.name}</span>}
      </li>)}
    </ol></nav>
  </div>;
}
