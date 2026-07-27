package com.metaplatform.data.repository;

import com.metaplatform.data.entity.LakeTableEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 数据湖表仓储。
 */
@Repository
public interface LakeTableRepository extends JpaRepository<LakeTableEntity, String> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<LakeTableEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<LakeTableEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 格式分页查询。
     */
    Page<LakeTableEntity> findByTenantIdAndFormat(String tenantId, String format, Pageable pageable);

    /**
     * 按租户 + 数据库 + 表名查询。
     */
    Page<LakeTableEntity> findByTenantIdAndDatabaseNameAndTableName(String tenantId, String databaseName, String tableName, Pageable pageable);

    /**
     * 校验唯一性：(tenant_id, database_name, table_name, format) 是否已存在。
     */
    boolean existsByTenantIdAndDatabaseNameAndTableNameAndFormat(String tenantId, String databaseName, String tableName, String format);
}
