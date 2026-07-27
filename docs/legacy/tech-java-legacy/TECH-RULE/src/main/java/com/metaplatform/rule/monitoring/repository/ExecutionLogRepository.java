package com.metaplatform.rule.monitoring.repository;

import com.metaplatform.rule.monitoring.entity.ExecutionLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ExecutionLogRepository extends JpaRepository<ExecutionLogEntity, String> {

    Page<ExecutionLogEntity> findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            String tenantId, Instant start, Instant end, Pageable pageable);

    List<ExecutionLogEntity> findByTenantIdAndRuleIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            String tenantId, String ruleId, Instant start, Instant end);

    Page<ExecutionLogEntity> findByTenantIdAndErrorMessageIsNotNullOrderByCreatedAtDesc(
            String tenantId, Pageable pageable);

    long countByTenantId(String tenantId);

    long countByTenantIdAndMatchedTrue(String tenantId);

    long countByTenantIdAndErrorMessageIsNotNull(String tenantId);

    List<ExecutionLogEntity> findByTenantIdAndRuleIdOrderByCreatedAtDesc(String tenantId, String ruleId, Pageable pageable);

    /**
     * P1-1：按租户计算平均执行耗时（全部日志，非仅错误日志）。
     * 返回 null 时调用方需兜底为 0。
     */
    @Query("SELECT COALESCE(AVG(e.executionTimeMs), 0) FROM ExecutionLogEntity e " +
            "WHERE e.tenantId = :tenantId AND e.executionTimeMs IS NOT NULL")
    Double findAvgExecutionTimeByTenantId(@Param("tenantId") String tenantId);

    /**
     * P1-1：按租户列出所有 rule_id 非空的日志的 rule_id 去重列表（用于 byRule 聚合）。
     */
    @Query("SELECT DISTINCT e.ruleId FROM ExecutionLogEntity e " +
            "WHERE e.tenantId = :tenantId AND e.ruleId IS NOT NULL")
    List<String> findDistinctRuleIdsByTenantId(@Param("tenantId") String tenantId);

    /**
     * P1-1：按规则 ID + 租户聚合统计：返回 [total, matched, errors, avgTime]。
     * 用投影数组返回，避免多次 SQL 查询。
     */
    @Query("SELECT COUNT(e), " +
            "COALESCE(SUM(CASE WHEN e.matched = true THEN 1 ELSE 0 END), 0), " +
            "COALESCE(SUM(CASE WHEN e.errorMessage IS NOT NULL THEN 1 ELSE 0 END), 0), " +
            "COALESCE(AVG(e.executionTimeMs), 0) " +
            "FROM ExecutionLogEntity e " +
            "WHERE e.tenantId = :tenantId AND e.ruleId = :ruleId")
    Object[] aggregateByTenantIdAndRuleId(@Param("tenantId") String tenantId, @Param("ruleId") String ruleId);
}
