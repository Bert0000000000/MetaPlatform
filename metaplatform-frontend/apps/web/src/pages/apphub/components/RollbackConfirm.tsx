import { Banner, Typography } from '@douyinfe/semi-ui';
import type { AppVersion } from '@/api/apphub/versions';

interface RollbackConfirmProps {
  current: AppVersion;
  target: AppVersion;
}

export default function RollbackConfirm({ current, target }: RollbackConfirmProps) {
  return (
    <Banner
      type="warning"
      title={
        <Typography.Text>
          即将从 <strong>v{current.version}</strong> 回滚到{' '}
          <strong style={{ color: 'var(--destructive)' }}>v{target.version}</strong>？
        </Typography.Text>
      }
      description={
        <div>
          <div>当前线上版本：<strong>v{current.version}</strong></div>
          <div>回滚目标版本：<strong>v{target.version}</strong></div>
          <div style={{ marginTop: 8, color: 'var(--warning)' }}>
            ⚠ 回滚后将立即覆盖线上版本，旧版本数据将归档保存。
          </div>
        </div>
      }
    />
  );
}
