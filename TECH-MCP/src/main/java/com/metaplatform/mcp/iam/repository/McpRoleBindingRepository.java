package com.metaplatform.mcp.iam.repository;

import com.metaplatform.mcp.iam.entity.McpRoleBindingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface McpRoleBindingRepository extends JpaRepository<McpRoleBindingEntity, String> {

    List<McpRoleBindingEntity> findByTenantIdAndSubjectTypeAndSubjectId(String tenantId, String subjectType, String subjectId);
}