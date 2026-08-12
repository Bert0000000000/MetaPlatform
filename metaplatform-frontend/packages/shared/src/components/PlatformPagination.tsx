import { Pagination } from 'antd';
import type { PaginationProps } from 'antd';

/**
 * 平台统一分页。封装 antd Pagination，统一配置项（showSizeChanger / showTotal）。
 * 新代码统一用 PlatformPagination，避免各页各自拼接配置。
 */
export interface PlatformPaginationProps extends PaginationProps {}

export default function PlatformPagination({ showSizeChanger = true, showTotal, ...rest }: PlatformPaginationProps) {
  return (
    <Pagination
      showSizeChanger={showSizeChanger}
      showTotal={
        showTotal ??
        ((total: number) => (
          <span style={{ fontSize: 12, color: '#a1a1a1' }}>共 {total} 条</span>
        ))
      }
      {...rest}
    />
  );
}
