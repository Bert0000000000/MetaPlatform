package com.metaplatform.mcp.iam.repository;

import com.metaplatform.mcp.iam.entity.McpApiKeyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface McpApiKeyRepository extends JpaRepository<McpApiKeyEntity, String> {

    Optional<McpApiKeyEntity> findByTenantIdAndKeyId(String tenantId, String keyId);

    List<McpApiKeyEntity> findByTenantIdAndEnabledTrue(String tenantId);
}