package com.metaplatform.mcp.debug.repository;

import com.metaplatform.mcp.debug.entity.McpDebugSessionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpDebugSessionRepository extends JpaRepository<McpDebugSessionEntity, UUID> {

    Optional<McpDebugSessionEntity> findByIdAndTenantId(UUID id, String tenantId);

    Page<McpDebugSessionEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);
}
