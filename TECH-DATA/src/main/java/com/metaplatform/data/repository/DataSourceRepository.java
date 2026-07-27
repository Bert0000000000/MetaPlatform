package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DataSourceEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 数据源仓储。
 */
@Repository
public interface DataSourceRepository extends JpaRepository<DataSourceEntity, String> {

    /**
     * 按租户 + ID 查询数据源。
     */
    Optional<DataSourceEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<DataSourceEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<DataSourceEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 校验唯一性：(tenant_id, name) 是否已存在。
     */
    boolean existsByTenantIdAndName(String tenantId, String name);

    /**
     * 关键词模糊检索（名称 / source_type），租户隔离。
     */
    @Query("SELECT d FROM DataSourceEntity d " +
            "WHERE d.tenantId = :tenantId " +
            "AND (LOWER(d.name) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) " +
            "     OR LOWER(d.sourceType) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))")
    Page<DataSourceEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                            @Param("keyword") String keyword,
                                            Pageable pageable);
}
