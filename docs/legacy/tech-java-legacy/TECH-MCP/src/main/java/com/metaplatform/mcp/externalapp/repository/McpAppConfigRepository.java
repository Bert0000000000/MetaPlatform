package com.metaplatform.mcp.externalapp.repository;

import com.metaplatform.mcp.externalapp.entity.McpAppConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface McpAppConfigRepository extends JpaRepository<McpAppConfigEntity, Long> {

    Optional<McpAppConfigEntity> findByTenantIdAndAppId(String tenantId, String appId);

    boolean existsByTenantIdAndAppId(String tenantId, String appId);
}
