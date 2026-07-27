package com.metaplatform.mcp.monitor.repository;

import com.metaplatform.mcp.monitor.entity.McpHealthCheckEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface McpHealthCheckRepository extends JpaRepository<McpHealthCheckEntity, Long> {
}
