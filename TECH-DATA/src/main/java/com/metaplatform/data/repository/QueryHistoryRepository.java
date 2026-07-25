package com.metaplatform.data.repository;

import com.metaplatform.data.entity.QueryHistoryEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 查询历史仓储。
 */
@Repository
public interface QueryHistoryRepository extends JpaRepository<QueryHistoryEntity, Long> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<QueryHistoryEntity> findByIdAndTenantId(Long id, String tenantId);

    /**
     * 按租户分页查询，按执行时间倒序。
     */
    Page<QueryHistoryEntity> findByTenantIdOrderByExecutedAtDesc(String tenantId, Pageable pageable);

    /**
     * 按租户 + 数据源 ID 分页查询，按执行时间倒序。
     */
    Page<QueryHistoryEntity> findByTenantIdAndDatasourceIdOrderByExecutedAtDesc(String tenantId, String datasourceId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<QueryHistoryEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 执行人分页查询。
     */
    Page<QueryHistoryEntity> findByTenantIdAndExecutedBy(String tenantId, String executedBy, Pageable pageable);

    /**
     * 按查询 ID 唯一查询。
     */
    Optional<QueryHistoryEntity> findByQueryId(String queryId);
}
