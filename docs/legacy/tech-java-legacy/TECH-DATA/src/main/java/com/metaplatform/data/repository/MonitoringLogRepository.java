package com.metaplatform.data.repository;

import com.metaplatform.data.entity.MonitoringLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 监控日志仓储。
 */
@Repository
public interface MonitoringLogRepository extends JpaRepository<MonitoringLogEntity, Long> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<MonitoringLogEntity> findByIdAndTenantId(Long id, String tenantId);

    /**
     * 按租户分页查询，按创建时间倒序。
     */
    Page<MonitoringLogEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    /**
     * 按租户 + 组件分页查询，按创建时间倒序。
     */
    Page<MonitoringLogEntity> findByTenantIdAndComponentOrderByCreatedAtDesc(String tenantId, String component, Pageable pageable);

    /**
     * 按租户 + 级别分页查询。
     */
    Page<MonitoringLogEntity> findByTenantIdAndLevel(String tenantId, String level, Pageable pageable);
}
