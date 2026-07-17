package com.metaplatform.mcp.tool.repository;

import com.metaplatform.mcp.tool.entity.McpToolExecutionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpToolExecutionRepository extends JpaRepository<McpToolExecutionEntity, UUID> {

    Optional<McpToolExecutionEntity> findByIdAndTenantId(UUID id, String tenantId);
}
