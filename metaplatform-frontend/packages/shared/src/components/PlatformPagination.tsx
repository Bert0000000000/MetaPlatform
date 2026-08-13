import { Pagination } from '@douyinfe/semi-ui';

/**
 * 平台统一分页，基于 Semi Pagination。
 * 统一配置项（showSizeChanger / showTotal）。
 */
export type PlatformPaginationProps = React.ComponentProps<typeof Pagination>;

export default function PlatformPagination({ showSizeChanger = true, size = 'small', ...rest }: PlatformPaginationProps) {
  return <Pagination showSizeChanger={showSizeChanger} showTotal size={size} {...rest} />;
}
