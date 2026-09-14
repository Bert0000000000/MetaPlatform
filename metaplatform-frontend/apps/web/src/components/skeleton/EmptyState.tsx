import { Empty } from '@douyinfe/semi-ui';
import {
  IllustrationFailure,
  IllustrationFailureDark,
  IllustrationIdle,
  IllustrationIdleDark,
  IllustrationNoAccess,
  IllustrationNoAccessDark,
  IllustrationNoContent,
  IllustrationNoContentDark,
  IllustrationNoResult,
  IllustrationNoResultDark,
  IllustrationSuccess,
  IllustrationSuccessDark,
} from '@douyinfe/semi-illustrations';
import type { ReactNode } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

export type EmptyStateIllustration =
  | 'no-content'
  | 'no-result'
  | 'no-access'
  | 'failure'
  | 'success'
  | 'idle';

export interface EmptyStateProps {
  title?: ReactNode;
  desc?: ReactNode;
  /** 操作区（新建 / 导入等），主操作用 Semi Button primary */
  actions?: ReactNode;
  /** 场景语义，取 Semi 官方插画（浅/深各有成套素材） */
  illustration?: EmptyStateIllustration;
  /** 仅当业务确需覆盖插画时使用；常规空态请走 illustration */
  icon?: ReactNode;
  className?: string;
}

const LIGHT = {
  'no-content': IllustrationNoContent,
  'no-result': IllustrationNoResult,
  'no-access': IllustrationNoAccess,
  failure: IllustrationFailure,
  success: IllustrationSuccess,
  idle: IllustrationIdle,
};

const DARK = {
  'no-content': IllustrationNoContentDark,
  'no-result': IllustrationNoResultDark,
  'no-access': IllustrationNoAccessDark,
  failure: IllustrationFailureDark,
  success: IllustrationSuccessDark,
  idle: IllustrationIdleDark,
};

/**
 * EmptyState —— 空状态骨架。基于 Semi Empty + 官方 Illustration 成套素材，
 * 不自绘图标空态（DESIGN-SPEC §5 共享元素）。
 */
export default function EmptyState({
  title = '暂无数据',
  desc,
  actions,
  illustration = 'no-content',
  icon,
  className,
}: EmptyStateProps) {
  const { resolvedTheme } = useSettings();
  const Illustration = (resolvedTheme === 'dark' ? DARK : LIGHT)[illustration];

  return (
    <div className={className ? `mp-empty ${className}` : 'mp-empty'}>
      <Empty
        image={
          icon ?? (
            <span className="mp-empty-art">
              <Illustration />
            </span>
          )
        }
        title={title}
        description={desc}
      />
      {actions ? <div className="mp-empty-actions">{actions}</div> : null}
    </div>
  );
}
