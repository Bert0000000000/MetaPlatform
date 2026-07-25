package com.metaplatform.data.datasources.support;

import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.DataSourceEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.DataSourceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * DataSourceRepository 访问辅助（封装租户上下文 + 异常转换）。
 *
 * <p>独立抽出以便 {@link DataSourceManager} 等 support 组件复用，避免循环依赖。</p>
 */
@Component
@RequiredArgsConstructor
public class DataSourceRepositoryHelper {

    private final DataSourceRepository dataSourceRepository;

    public DataSourceEntity requireDataSource(String id) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return dataSourceRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.DATASOURCE_NOT_FOUND, "数据源不存在: " + id));
    }

    public DataSourceEntity findByIdAndTenantId(String id, String tenantId) {
        return dataSourceRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.DATASOURCE_NOT_FOUND, "数据源不存在: " + id));
    }
}
