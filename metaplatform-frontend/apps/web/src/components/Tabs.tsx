import { useState, type ReactNode } from "react";

export interface TabItem {
  key: string;
  label: ReactNode;
  children: ReactNode;
}

interface TabsProps {
  defaultActiveKey?: string;
  activeKey?: string;
  onChange?: (key: string) => void;
  items: TabItem[];
  tabBarStyle?: React.CSSProperties;
  renderLabel?: (item: TabItem) => ReactNode;
}

/**
 * 轻量 Tab 组件 — 避免 antd 6 Tabs 的 `nodes.map is not a function` bug。
 * 设计为统一的后台管理 tab 样式：底部 1px 边框，选中态 muted 背景。
 */
export function Tabs({ defaultActiveKey, activeKey, onChange, items, tabBarStyle, renderLabel }: TabsProps) {
  const [internalActive, setInternalActive] = useState(defaultActiveKey ?? items[0]?.key ?? "");
  const active = activeKey ?? internalActive;
  const activeItem = items.find((it) => it.key === active) ?? items[0];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
          ...tabBarStyle,
        }}
      >
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                if (!activeKey) setInternalActive(it.key);
                onChange?.(it.key);
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                background: isActive ? "var(--muted)" : "transparent",
                border: "none",
                fontFamily: "var(--font-sans)",
                marginBottom: -1,
                borderBottom: isActive ? "2px solid var(--foreground)" : "2px solid transparent",
              }}
            >
              {renderLabel ? renderLabel(it) : it.label}
            </button>
          );
        })}
      </div>
      <div>{activeItem?.children}</div>
    </div>
  );
}
