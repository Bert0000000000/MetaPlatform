package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DeliverableEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 交付物仓储。
 */
@Repository
public interface DeliverableRepository extends JpaRepository<DeliverableEntity, String> {

    /**
     * 按租户 + ID 查询交付物。
     */
    Optional<DeliverableEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<DeliverableEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 类型分页查询。
     */
    Page<DeliverableEntity> findByTenantIdAndType(String tenantId, String type, Pageable pageable);

    /**
     * 按租户 + 类型 + 来源分页查询。
     */
    Page<DeliverableEntity> findByTenantIdAndTypeAndSource(String tenantId, String type, String source, Pageable pageable);

    /**
     * 按租户 + 创建人分页查询。
     */
    Page<DeliverableEntity> findByTenantIdAndCreatedBy(String tenantId, String createdBy, Pageable pageable);
}
