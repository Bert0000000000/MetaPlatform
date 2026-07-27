package com.metaplatform.data.repository;

import com.metaplatform.data.entity.QualityRuleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 数据质量规则仓储。
 */
@Repository
public interface QualityRuleRepository extends JpaRepository<QualityRuleEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<QualityRuleEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<QualityRuleEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 目标资产 ID 分页查询。
     */
    Page<QualityRuleEntity> findByTenantIdAndTargetAssetId(String tenantId, String targetAssetId, Pageable pageable);

    /**
     * 按租户 + 启用状态分页查询。
     */
    Page<QualityRuleEntity> findByTenantIdAndEnabled(String tenantId, Boolean enabled, Pageable pageable);

    /**
     * 按租户 + 类型分页查询。
     */
    Page<QualityRuleEntity> findByTenantIdAndType(String tenantId, String type, Pageable pageable);
}
