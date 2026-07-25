package com.metaplatform.data.repository;

import com.metaplatform.data.entity.CatalogAssetEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 数据目录资产仓储。
 */
@Repository
public interface CatalogAssetRepository extends JpaRepository<CatalogAssetEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<CatalogAssetEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<CatalogAssetEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 类型分页查询。
     */
    Page<CatalogAssetEntity> findByTenantIdAndType(String tenantId, String type, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<CatalogAssetEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 拥有者分页查询。
     */
    Page<CatalogAssetEntity> findByTenantIdAndOwner(String tenantId, String owner, Pageable pageable);

    /**
     * 按租户 + 分类分级分页查询。
     */
    Page<CatalogAssetEntity> findByTenantIdAndClassification(String tenantId, String classification, Pageable pageable);
}
