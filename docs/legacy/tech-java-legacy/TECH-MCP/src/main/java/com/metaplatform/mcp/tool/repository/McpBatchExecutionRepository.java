package com.metaplatform.mcp.tool.repository;

import com.metaplatform.mcp.tool.entity.McpBatchExecutionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpBatchExecutionRepository extends JpaRepository<McpBatchExecutionEntity, UUID> {

    List<McpBatchExecutionEntity> findByTenantIdAndBatchId(String tenantId, String batchId);

    Optional<McpBatchExecutionEntity> findByIdAndTenantId(UUID id, String tenantId);
}
