import React from "react";

/**
 * 内置 SVG 图标集（@mate/shared 0 外部依赖版）。
 *
 * <p>替代 @ant-design/icons，避免在 pnpm 严格隔离下因 hoist 失败导致
 * "Failed to resolve import" 错误。所有图标均 24x24 viewBox / currentColor。</p>
 */

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const make = (path: React.ReactNode, viewBox = "0 0 24 24"): React.FC<IconProps> => {
  const C: React.FC<IconProps> = ({ size = 16, ...rest }) => (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {path}
    </svg>
  );
  C.displayName = "Icon";
  return C;
};

export const BulbOutlined = make(
  <>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.5 1 2.3V18h6v-1c0-.8.3-1.7 1-2.3A7 7 0 0 0 12 2Z" />
  </>
);

export const FileSearchOutlined = make(
  <>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="14 3 14 9 20 9" />
    <circle cx="11" cy="15" r="2" />
    <path d="m13 17 2 2" />
  </>
);

export const RobotOutlined = make(
  <>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M12 4v4" />
    <circle cx="8.5" cy="14" r="1" />
    <circle cx="15.5" cy="14" r="1" />
    <path d="M9 18h6" />
  </>
);

export const DownloadOutlined = make(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>
);

export const EyeOutlined = make(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

export const CheckCircleOutlined = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>
);

export const CloseCircleOutlined = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </>
);

export const SendOutlined = make(
  <>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </>
);

export const RobotFill = RobotOutlined;

export const ThunderboltOutlined = make(
  <>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </>
);

export const PlusOutlined = make(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>
);

export const SearchOutlined = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.5" y2="16.5" />
  </>
);

// 平台导航图标（PlatformMenu 替代 lucide-react）
export const LayoutDashboard = make(
  <>
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </>
);
export const Sparkles = make(
  <>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="2" />
  </>
);
export const GitBranch = make(
  <>
    <circle cx="6" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M6 8v8" />
    <path d="M18 8a4 4 0 0 1-4 4H8" />
  </>
);
export const Boxes = make(
  <>
    <path d="M3 7l9-4 9 4-9 4-9-4Z" />
    <path d="M3 7v10l9 4 9-4V7" />
    <path d="M12 11v10" />
  </>
);
export const Database = make(
  <>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </>
);
export const BookOpen = make(
  <>
    <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2Z" />
    <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z" />
  </>
);
export const Plug = make(
  <>
    <path d="M9 2v6M15 2v6" />
    <path d="M5 8h14v3a5 5 0 0 1-10 0V8" />
    <path d="M12 16v6" />
  </>
);
export const Bot = make(
  <>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M12 4v4" />
    <circle cx="8.5" cy="14" r="1" />
    <circle cx="15.5" cy="14" r="1" />
    <path d="M9 18h6" />
  </>
);
export const Settings = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.6-2-3.5-2.4.9a7 7 0 0 0-2-1.1L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.1l-2.4-.9-2 3.5 2 1.6A7 7 0 0 0 5 12c0 .4 0 .7.1 1.1l-2 1.6 2 3.5 2.4-.9a7 7 0 0 0 2 1.1L10 21h4l.5-2.6a7 7 0 0 0 2-1.1l2.4.9 2-3.5-2-1.6c.1-.4.1-.7.1-1.1Z" />
  </>
);
export type LucideIcon = React.FC<IconProps>;

// 布局组件替代图标（替代 lucide-react）
export const User = make(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>
);
export const LogOut = make(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>
);
export const ChevronsLeft = make(
  <>
    <polyline points="11 17 6 12 11 7" />
    <polyline points="18 17 13 12 18 7" />
  </>
);
export const ChevronsRight = make(
  <>
    <polyline points="13 17 18 12 13 7" />
    <polyline points="6 17 11 12 6 7" />
  </>
);
export const Search = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.5" y2="16.5" />
  </>
);
export const Menu = make(
  <>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </>
);
export const Store = make(
  <>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
    <path d="M3 9a2 2 0 0 0 2 2 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 0 2 4 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 0 2 4 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 0 2 4 2 2 0 0 0 2-2" />
    <path d="M9 21v-6h6v6" />
  </>
);
