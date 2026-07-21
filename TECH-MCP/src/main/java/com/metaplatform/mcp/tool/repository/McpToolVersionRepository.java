package com.metaplatform.mcp.tool.repository;

import com.metaplatform.mcp.tool.entity.McpToolVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpToolVersionRepository extends JpaRepository<McpToolVersionEntity, UUID> {

    List<McpToolVersionEntity> findByToolIdAndTenantIdOrderByCreatedAtDesc(UUID toolId, String tenantId);

    Optional<McpToolVersionEntity> findByIdAndTenantId(UUID id, String tenantId);

    List<McpToolVersionEntity> findByToolIdAndTenantIdAndIsCurrentTrue(UUID toolId, String tenantId);

    Optional<McpToolVersionEntity> findByToolIdAndVersionAndTenantId(UUID toolId, String version, String tenantId);

    @Modifying
    @Query("UPDATE McpToolVersionEntity v SET v.isCurrent = false WHERE v.toolId = :toolId AND v.tenantId = :tenantId")
    void clearCurrentByToolId(@Param("toolId") UUID toolId, @Param("tenantId") String tenantId);
}
