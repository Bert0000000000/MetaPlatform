package com.metaplatform.mcp.ratelimit.repository;

import com.metaplatform.mcp.ratelimit.entity.McpRateLimitEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface McpRateLimitRepository extends JpaRepository<McpRateLimitEntity, String> {

    List<McpRateLimitEntity> findByTenantIdAndToolIdAndWindowStartAfter(String tenantId, String toolId, OffsetDateTime windowStart);
}