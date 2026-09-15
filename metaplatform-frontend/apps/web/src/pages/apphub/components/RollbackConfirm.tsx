import { Banner, Typography } from '@douyinfe/semi-ui';
import type { AppVersion } from '@/api/apphub/versions';
import { IconAlertTriangle } from '@douyinfe/semi-icons';

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
          <strong className="mp-text-danger">v{target.version}</strong>？
        </Typography.Text>
      }
      description={
        <div>
          <div>当前线上版本：<strong>v{current.version}</strong></div>
          <div>回滚目标版本：<strong>v{target.version}</strong></div>
          <div className="mp-mt-2 mp-text-warning mp-flex-center mp-gap-1" >
            <IconAlertTriangle size="small" /> 回滚后将立即覆盖线上版本，旧版本数据将归档保存。
          </div>
        </div>
      }
    />
  );
}
