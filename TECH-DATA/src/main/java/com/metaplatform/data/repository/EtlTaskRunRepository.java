package com.metaplatform.data.repository;

import com.metaplatform.data.entity.EtlTaskRunEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * ETL 任务运行历史仓储。
 */
@Repository
public interface EtlTaskRunRepository extends JpaRepository<EtlTaskRunEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<EtlTaskRunEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<EtlTaskRunEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 任务 ID 分页查询，按开始时间倒序。
     */
    Page<EtlTaskRunEntity> findByTenantIdAndTaskIdOrderByStartedAtDesc(String tenantId, String taskId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<EtlTaskRunEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 任务 ID 分页查询。
     */
    Page<EtlTaskRunEntity> findByTenantIdAndTaskId(String tenantId, String taskId, Pageable pageable);
}
