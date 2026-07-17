package com.metaplatform.rule.monitoring.repository;

import com.metaplatform.rule.monitoring.entity.ExecutionLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
