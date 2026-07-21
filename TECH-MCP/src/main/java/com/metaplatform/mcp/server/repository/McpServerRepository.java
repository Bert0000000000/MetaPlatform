package com.metaplatform.mcp.server.repository;

import com.metaplatform.mcp.server.entity.McpServerEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpServerRepository extends JpaRepository<McpServerEntity, UUID> {

    Optional<McpServerEntity> findByIdAndDeletedAtIsNull(UUID id);

    Optional<McpServerEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    @Query("SELECT s FROM McpServerEntity s " +
           "WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL " +
           "AND (:status IS NULL OR s.status = :status) " +
           "AND (:keyword IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(s.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<McpServerEntity> search(@Param("tenantId") String tenantId,
                                  @Param("status") String status,
                                  @Param("keyword") String keyword,
                                  Pageable pageable);

    @Query("SELECT s.status, COUNT(s) FROM McpServerEntity s " +
           "WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL " +
           "GROUP BY s.status")
    List<Object[]> countByStatus(@Param("tenantId") String tenantId);

    List<McpServerEntity> findByTenantIdAndDeletedAtIsNull(String tenantId, Sort sort);
}
