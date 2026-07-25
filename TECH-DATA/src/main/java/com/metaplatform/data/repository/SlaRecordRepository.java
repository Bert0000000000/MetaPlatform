package com.metaplatform.data.repository;

import com.metaplatform.data.entity.SlaRecordEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * SLA 记录仓储。
 */
@Repository
public interface SlaRecordRepository extends JpaRepository<SlaRecordEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<SlaRecordEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询，按测量时间倒序。
     */
    Page<SlaRecordEntity> findByTenantIdOrderByMeasuredAtDesc(String tenantId, Pageable pageable);

    /**
     * 按租户 + 目标类型 + 目标 ID 分页查询。
     */
    Page<SlaRecordEntity> findByTenantIdAndTargetTypeAndTargetId(String tenantId, String targetType, String targetId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<SlaRecordEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 指标分页查询。
     */
    Page<SlaRecordEntity> findByTenantIdAndMetric(String tenantId, String metric, Pageable pageable);
}
