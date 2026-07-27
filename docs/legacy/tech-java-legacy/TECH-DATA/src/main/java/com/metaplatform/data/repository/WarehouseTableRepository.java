package com.metaplatform.data.repository;

import com.metaplatform.data.entity.WarehouseTableEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 数据仓库表仓储。
 */
@Repository
public interface WarehouseTableRepository extends JpaRepository<WarehouseTableEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<WarehouseTableEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<WarehouseTableEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 分层分页查询。
     */
    Page<WarehouseTableEntity> findByTenantIdAndLayer(String tenantId, String layer, Pageable pageable);

    /**
     * 按租户 + 数据库 + 表名查询。
     */
    Page<WarehouseTableEntity> findByTenantIdAndDatabaseNameAndTableName(String tenantId, String databaseName, String tableName, Pageable pageable);
}
