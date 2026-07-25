package com.metaplatform.data.repository;

import com.metaplatform.data.entity.IngestTaskEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 数据摄入任务仓储。
 */
@Repository
public interface IngestTaskRepository extends JpaRepository<IngestTaskEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<IngestTaskEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<IngestTaskEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<IngestTaskEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 模式分页查询。
     */
    Page<IngestTaskEntity> findByTenantIdAndMode(String tenantId, String mode, Pageable pageable);

    /**
     * 按租户 + 源数据源 ID 分页查询。
     */
    Page<IngestTaskEntity> findByTenantIdAndSourceDsId(String tenantId, String sourceDsId, Pageable pageable);
}
