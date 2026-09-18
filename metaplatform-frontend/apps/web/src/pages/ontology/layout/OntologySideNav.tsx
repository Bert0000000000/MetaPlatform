import { NavLink } from 'react-router-dom';
import { ONTOLOGY_NAV, type OntologyNavIcon } from '../navigation';

/** 统一渲染登记在 ONTOLOGY_NAV 里的图标组件（配置模块只存组件引用，不写 JSX）。 */
function NavIcon({ icon }: { icon?: OntologyNavIcon }) {
  const Icon = icon;
  if (!Icon) return null;
  return <Icon size={15} strokeWidth={1.5} />;
}

/**
 * 本体工作区左侧导航（ADR-0069 §2.1 / 设计规格 §5.1）。
 *
 * <p>渲染 `ONTOLOGY_NAV` 的全部功能域分组 + active 子项；`planned` / `hidden`
 * 不渲染（不展示假功能）。高亮 = NavLink 前缀命中（详情页 :rid 归入其列表项），
 * 总览是域根用 `end` 防止全量前缀误高亮——不写 `pathname.startsWith('/ontology')`
 * 之类的散落特判。
 *
 * <p>折叠：≤1024px 时 CSS 自动收窄（组标签/文字隐藏）；交互式折叠非首批阻断项。
 */
export default function OntologySideNav() {
  return (
    <nav className="mp-onto-sidenav" aria-label="本体工作区导航">
      {ONTOLOGY_NAV.map((group) => {
        const items = (group.children ?? []).filter((c) => c.status === 'active' && c.path);
        if (items.length === 0) {
          // 直达功能域（总览）：一行链接，自身即分组。
          return group.status === 'active' && group.path ? (
            <div key={group.key} className="mp-onto-sidenav-group">
              <NavLink
                to={group.path}
                end
                className={({ isActive }) =>
                  `mp-onto-sidenav-link mp-onto-sidenav-link--top${isActive ? ' is-active' : ''}`
                }
              >
                <NavIcon icon={group.icon} />
                <span className="mp-onto-sidenav-link-label">{group.label}</span>
              </NavLink>
            </div>
          ) : null;
        }
        return (
          <div key={group.key} className="mp-onto-sidenav-group">
            <div className="mp-onto-sidenav-group-label">
              <NavIcon icon={group.icon} />
              <span>{group.label}</span>
            </div>
            {items.map((item) => (
              <NavLink
                key={item.key}
                to={item.path as string}
                className={({ isActive }) => `mp-onto-sidenav-link${isActive ? ' is-active' : ''}`}
              >
                <span className="mp-onto-sidenav-link-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
