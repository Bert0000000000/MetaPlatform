package com.metaplatform.mcp.externalapp.repository;

import com.metaplatform.mcp.externalapp.entity.McpAppApiKeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface McpAppApiKeyRepository extends JpaRepository<McpAppApiKeyEntity, Long> {

    List<McpAppApiKeyEntity> findByTenantIdAndAppId(String tenantId, String appId);

    List<McpAppApiKeyEntity> findByTenantIdAndAppIdAndStatus(String tenantId, String appId, String status);

    Optional<McpAppApiKeyEntity> findByTenantIdAndKeyId(String tenantId, String keyId);

    long deleteByTenantIdAndKeyId(String tenantId, String keyId);
}
