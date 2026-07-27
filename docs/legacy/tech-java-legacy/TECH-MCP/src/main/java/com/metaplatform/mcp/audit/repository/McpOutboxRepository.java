package com.metaplatform.mcp.audit.repository;

import com.metaplatform.mcp.audit.entity.McpOutboxEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface McpOutboxRepository extends JpaRepository<McpOutboxEntity, Long> {

    List<McpOutboxEntity> findByTenantIdAndStatusOrderByCreatedAt(String tenantId, String status);

    List<McpOutboxEntity> findTop100ByStatusOrderByCreatedAtAsc(String status);
}