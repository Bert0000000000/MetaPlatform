package com.metaplatform.rule.statistics.repository;

import com.metaplatform.rule.statistics.entity.RuleExecutionStatEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface RuleExecutionStatRepository extends JpaRepository<RuleExecutionStatEntity, String> {

    List<RuleExecutionStatEntity> findByTenantIdAndExecutionDateBetween(
            String tenantId, LocalDate start, LocalDate end);

    List<RuleExecutionStatEntity> findByTenantIdAndTargetTypeAndTargetId(
            String tenantId, String targetType, String targetId);

    Optional<RuleExecutionStatEntity> findByTenantIdAndTargetTypeAndTargetIdAndExecutionDate(
            String tenantId, String targetType, String targetId, LocalDate executionDate);

    List<RuleExecutionStatEntity> findByTenantIdAndExecutionDate(String tenantId, LocalDate executionDate);

    Page<RuleExecutionStatEntity> findByTenantIdAndErrorCountGreaterThanOrderByExecutionDateDesc(
            String tenantId, int errorCount, Pageable pageable);

    Page<RuleExecutionStatEntity> findByTenantIdOrderByExecutionDateDescTargetTypeAscTargetIdAsc(
            String tenantId, Pageable pageable);
}
