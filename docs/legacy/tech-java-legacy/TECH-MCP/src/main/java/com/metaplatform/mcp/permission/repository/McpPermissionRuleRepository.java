package com.metaplatform.mcp.permission.repository;

import com.metaplatform.mcp.permission.entity.McpPermissionRuleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface McpPermissionRuleRepository extends JpaRepository<McpPermissionRuleEntity, Long> {

    Optional<McpPermissionRuleEntity> findByTenantIdAndRuleId(String tenantId, String ruleId);

    /**
     * 查询命中给定 subject + resource 的候选规则（resourceId 为 NULL 视为通配）。
     * 用于权限检查：caller 在 service 层按 priority + effect 做最终裁决。
     */
    @Query("SELECT r FROM McpPermissionRuleEntity r " +
           "WHERE r.tenantId = :tenantId " +
           "AND r.enabled = TRUE " +
           "AND (:subjectId IS NULL OR r.subjectId = :subjectId) " +
           "AND r.resourceType = :resourceType " +
           "AND (r.resourceId IS NULL OR r.resourceId = :resourceId) " +
           "ORDER BY r.priority DESC, r.createdAt ASC")
    List<McpPermissionRuleEntity> findCandidatesForCheck(@Param("tenantId") String tenantId,
                                                         @Param("subjectId") String subjectId,
                                                         @Param("resourceType") String resourceType,
                                                         @Param("resourceId") String resourceId);

    /**
     * 矩阵 / 列表查询：按 subjectId / resourceType 过滤（均可选）。
     */
    @Query("SELECT r FROM McpPermissionRuleEntity r " +
           "WHERE r.tenantId = :tenantId " +
           "AND (:subjectId IS NULL OR r.subjectId = :subjectId) " +
           "AND (:resourceType IS NULL OR r.resourceType = :resourceType) " +
           "ORDER BY r.priority DESC, r.createdAt ASC")
    Page<McpPermissionRuleEntity> search(@Param("tenantId") String tenantId,
                                         @Param("subjectId") String subjectId,
                                         @Param("resourceType") String resourceType,
                                         Pageable pageable);

    /**
     * 矩阵构建：一次拉取所有候选规则（仅 tenant + 可选 subject/resource 过滤），避免 N+1。
     */
    @Query("SELECT r FROM McpPermissionRuleEntity r " +
           "WHERE r.tenantId = :tenantId " +
           "AND r.enabled = TRUE " +
           "AND (:subjectId IS NULL OR r.subjectId = :subjectId) " +
           "AND (:resourceType IS NULL OR r.resourceType = :resourceType) " +
           "ORDER BY r.priority DESC, r.createdAt ASC")
    List<McpPermissionRuleEntity> findAllForMatrix(@Param("tenantId") String tenantId,
                                                   @Param("subjectId") String subjectId,
                                                   @Param("resourceType") String resourceType);

    /**
     * 应用工具授权：按 EXTERNAL_APP + subjectId(=appId) 查询所有授权规则。
     */
    List<McpPermissionRuleEntity> findByTenantIdAndSubjectTypeAndSubjectId(String tenantId,
                                                                           String subjectType,
                                                                           String subjectId);

    long deleteByTenantIdAndRuleId(String tenantId, String ruleId);
}
