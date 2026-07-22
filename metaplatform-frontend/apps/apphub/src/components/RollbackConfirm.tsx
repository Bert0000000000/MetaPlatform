import { Alert, Typography } from 'antd';
import type { AppVersion } from '@/api/versions';

interface RollbackConfirmProps {
  current: AppVersion;
  target: AppVersion;
}

export default function RollbackConfirm({ current, target }: RollbackConfirmProps) {
  return (
    <Alert
      type="warning"
      showIcon
      message={
        <Typography.Text>
          即将从 <strong>v{current.version}</strong> 回滚到{' '}
          <strong style={{ color: '#f5222d' }}>v{target.version}</strong>？
        </Typography.Text>
      }
      description={
        <div>
          <div>当前线上版本：<strong>v{current.version}</strong></div>
          <div>回滚目标版本：<strong>v{target.version}</strong></div>
          <div style={{ marginTop: 8, color: '#faad14' }}>
            ⚠ 回滚后将立即覆盖线上版本，旧版本数据将归档保存。
          </div>
        </div>
      }
    />
  );
}
