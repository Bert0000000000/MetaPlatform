package com.metaplatform.data.repository;

import com.metaplatform.data.entity.MaterializedViewEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 物化视图仓储。
 */
@Repository
public interface MaterializedViewRepository extends JpaRepository<MaterializedViewEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<MaterializedViewEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<MaterializedViewEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<MaterializedViewEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 刷新策略分页查询。
     */
    Page<MaterializedViewEntity> findByTenantIdAndRefreshStrategy(String tenantId, String refreshStrategy, Pageable pageable);

    /**
     * 校验唯一性：(tenant_id, name) 是否已存在。
     */
    boolean existsByTenantIdAndName(String tenantId, String name);
}
