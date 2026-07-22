import { ReactNode } from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Show Home icon before the first item */
  showHome?: boolean;
  /** padding: e.g. '8px 24px 0', '0 24px 20px' */
  padding?: string;
  /** font size */
  fontSize?: number;
  className?: string;
}

export function Breadcrumb({
  items,
  showHome = true,
  padding = '8px 24px 0',
  fontSize = 13,
  className,
}: BreadcrumbProps) {
  return (
    <nav
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize,
        color: 'var(--muted-foreground)',
        padding,
        flexShrink: 0,
      }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const isFirst = idx === 0;
        const content: ReactNode = isLast ? (
          <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{item.label}</span>
        ) : (
          <a
            onClick={item.onClick}
            href={item.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--muted-foreground)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'color .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            {isFirst && showHome && <Home style={{ width: fontSize + 1, height: fontSize + 1 }} />}
            {item.label}
          </a>
        );
        return (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {content}
            {!isLast && (
              <ChevronRight
                style={{ width: fontSize + 1, height: fontSize + 1, color: 'var(--border)', flexShrink: 0 }}
              />
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;