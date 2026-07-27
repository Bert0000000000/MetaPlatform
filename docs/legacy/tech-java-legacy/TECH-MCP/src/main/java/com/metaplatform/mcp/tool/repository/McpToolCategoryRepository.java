package com.metaplatform.mcp.tool.repository;

import com.metaplatform.mcp.tool.entity.McpToolCategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpToolCategoryRepository extends JpaRepository<McpToolCategoryEntity, UUID> {

    List<McpToolCategoryEntity> findByTenantIdAndDeletedAtIsNullOrderBySortOrderAsc(String tenantId);

    Optional<McpToolCategoryEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    Optional<McpToolCategoryEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}
