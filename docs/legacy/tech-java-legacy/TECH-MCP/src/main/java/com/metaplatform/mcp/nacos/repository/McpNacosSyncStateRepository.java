package com.metaplatform.mcp.nacos.repository;

import com.metaplatform.mcp.nacos.entity.McpNacosSyncStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface McpNacosSyncStateRepository extends JpaRepository<McpNacosSyncStateEntity, String> {

    Optional<McpNacosSyncStateEntity> findByTenantIdAndEntityTypeAndEntityId(String tenantId, String entityType, String entityId);

    List<McpNacosSyncStateEntity> findBySyncStatus(String syncStatus);
}