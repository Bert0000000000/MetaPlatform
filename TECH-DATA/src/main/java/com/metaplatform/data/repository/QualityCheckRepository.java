package com.metaplatform.data.repository;

import com.metaplatform.data.entity.QualityCheckEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 数据质量检查记录仓储。
 */
@Repository
public interface QualityCheckRepository extends JpaRepository<QualityCheckEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<QualityCheckEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<QualityCheckEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 规则 ID 分页查询，按检查时间倒序。
     */
    Page<QualityCheckEntity> findByTenantIdAndRuleIdOrderByCheckedAtDesc(String tenantId, String ruleId, Pageable pageable);

    /**
     * 按租户 + 资产 ID 分页查询。
     */
    Page<QualityCheckEntity> findByTenantIdAndAssetId(String tenantId, String assetId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<QualityCheckEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);
}
