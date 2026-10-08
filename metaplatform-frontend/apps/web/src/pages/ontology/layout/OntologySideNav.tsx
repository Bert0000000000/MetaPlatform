import { Link, useLocation } from 'react-router-dom';
import type { RefObject } from 'react';
import { ontologyNavigationGroups, ontologyGroupDefaultPath, resolveOntologyNav } from '../navigation';

export default function OntologySideNav({ onNavigate, navRef }: {
  onNavigate: () => void;
  navRef: RefObject<HTMLElement | null>;
}) {
  const { pathname } = useLocation();
  const match = resolveOntologyNav(pathname);
  return (
    <nav ref={navRef} id="ontology-workspace-nav" className="mp-onto-sidenav" aria-label="本体工作区导航">
      <div className="mp-onto-sidenav-head">
        <strong>本体工作室</strong><span>ONTOLOGY WORKSPACE</span>
      </div>
      <div className="mp-onto-sidenav-groups">
        {ontologyNavigationGroups().map(group => {
          const Icon = group.icon;
          const active = match?.group.key === group.key;
          return <section key={group.key} className="mp-onto-nav-group" data-active={active}>
            <Link className="mp-onto-nav-group-link" to={ontologyGroupDefaultPath(group)} onClick={onNavigate}
              aria-current={active && !match?.item ? 'page' : undefined}>
              {Icon && <Icon size={16} strokeWidth={1.5} />}<span>{group.label}</span>
            </Link>
            {group.children && <ul className="mp-onto-nav-children">
              {group.children.filter(item => item.status === 'active' && item.path).map(item => (
                <li key={item.key}><Link to={item.path!} onClick={onNavigate}
                  aria-current={match?.item?.key === item.key ? 'page' : undefined}>{item.label}
                  {item.advanced && <span className="mp-onto-nav-advanced" aria-hidden="true">高级</span>}
                </Link></li>
              ))}
            </ul>}
          </section>;
        })}
      </div>
    </nav>
  );
}
