package com.metaplatform.mcp.tool.repository;

import com.metaplatform.mcp.tool.entity.McpToolEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpToolRepository extends JpaRepository<McpToolEntity, UUID> {

    Optional<McpToolEntity> findByIdAndDeletedAtIsNull(UUID id);

    Optional<McpToolEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    List<McpToolEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<McpToolEntity> findByTenantIdAndEnabledTrueAndDeletedAtIsNull(String tenantId);

    List<McpToolEntity> findByTenantIdAndServerIdAndDeletedAtIsNull(String tenantId, UUID serverId);

    List<McpToolEntity> findByTenantIdAndToolTypeAndDeletedAtIsNull(String tenantId, String toolType);

    List<McpToolEntity> findByTenantIdAndEnabledAndDeletedAtIsNull(String tenantId, Boolean enabled);

    @Query("SELECT t FROM McpToolEntity t " +
           "WHERE t.tenantId = :tenantId AND t.deletedAt IS NULL " +
           "AND (:serverId IS NULL OR t.serverId = :serverId) " +
           "AND (:toolType IS NULL OR t.toolType = :toolType) " +
           "AND (:enabled IS NULL OR t.enabled = :enabled) " +
           "AND (:keyword IS NULL OR LOWER(t.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(t.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<McpToolEntity> search(@Param("tenantId") String tenantId,
                                @Param("serverId") UUID serverId,
                                @Param("toolType") String toolType,
                                @Param("enabled") Boolean enabled,
                                @Param("keyword") String keyword);
}
