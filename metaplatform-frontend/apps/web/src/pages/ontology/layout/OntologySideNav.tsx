import { Link, useLocation } from 'react-router-dom';
import { ONTOLOGY_NAV, ontologyGroupDefaultPath, resolveOntologyNav } from '../navigation';

export default function OntologySideNav({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const match = resolveOntologyNav(pathname);
  return (
    <nav id="ontology-workspace-nav" className="mp-onto-sidenav" aria-label="本体工作区导航">
      <div className="mp-onto-sidenav-head">
        <strong>本体建设</strong><span>ONTOLOGY WORKSPACE</span>
      </div>
      <div className="mp-onto-sidenav-groups">
        {ONTOLOGY_NAV.filter(group => group.status === 'active').map(group => {
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
                  aria-current={match?.item?.key === item.key ? 'page' : undefined}>{item.label}</Link></li>
              ))}
            </ul>}
          </section>;
        })}
      </div>
    </nav>
  );
}
