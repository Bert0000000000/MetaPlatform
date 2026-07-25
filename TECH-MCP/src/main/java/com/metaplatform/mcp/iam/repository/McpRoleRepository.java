package com.metaplatform.mcp.iam.repository;

import com.metaplatform.mcp.iam.entity.McpRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface McpRoleRepository extends JpaRepository<McpRoleEntity, String> {

    Optional<McpRoleEntity> findByTenantIdAndCode(String tenantId, String code);

    List<McpRoleEntity> findByTenantIdAndBuiltinTrue(String tenantId);
}