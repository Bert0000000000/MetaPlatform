package com.metaplatform.mcp.debug.repository;

import com.metaplatform.mcp.debug.entity.McpDebugBreakpointEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpDebugBreakpointRepository extends JpaRepository<McpDebugBreakpointEntity, UUID> {

    List<McpDebugBreakpointEntity> findBySessionIdAndTenantIdOrderByCreatedAtAsc(UUID sessionId, String tenantId);

    Optional<McpDebugBreakpointEntity> findByIdAndTenantId(UUID id, String tenantId);
}
