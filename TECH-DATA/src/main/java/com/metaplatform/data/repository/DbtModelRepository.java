package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DbtModelEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * DBT 模型仓储。
 */
@Repository
public interface DbtModelRepository extends JpaRepository<DbtModelEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<DbtModelEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<DbtModelEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 项目 ID 分页查询。
     */
    Page<DbtModelEntity> findByTenantIdAndProjectId(String tenantId, String projectId, Pageable pageable);

    /**
     * 按租户 + 项目 ID + 状态分页查询。
     */
    Page<DbtModelEntity> findByTenantIdAndProjectIdAndStatus(String tenantId, String projectId, String status, Pageable pageable);
}
