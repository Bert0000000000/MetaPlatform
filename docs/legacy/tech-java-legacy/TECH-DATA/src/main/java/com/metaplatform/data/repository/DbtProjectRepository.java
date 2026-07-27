package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DbtProjectEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * DBT 项目仓储。
 */
@Repository
public interface DbtProjectRepository extends JpaRepository<DbtProjectEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<DbtProjectEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<DbtProjectEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<DbtProjectEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 校验唯一性：(tenant_id, name) 是否已存在。
     */
    boolean existsByTenantIdAndName(String tenantId, String name);
}
