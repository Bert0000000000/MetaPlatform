package com.metaplatform.data.repository;

import com.metaplatform.data.entity.MonitoringAlertEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 监控告警仓储。
 */
@Repository
public interface MonitoringAlertRepository extends JpaRepository<MonitoringAlertEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<MonitoringAlertEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询，按触发时间倒序。
     */
    Page<MonitoringAlertEntity> findByTenantIdOrderByTriggeredAtDesc(String tenantId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<MonitoringAlertEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 严重级别分页查询。
     */
    Page<MonitoringAlertEntity> findByTenantIdAndSeverity(String tenantId, String severity, Pageable pageable);

    /**
     * 按租户 + 来源分页查询。
     */
    Page<MonitoringAlertEntity> findByTenantIdAndSource(String tenantId, String source, Pageable pageable);
}
