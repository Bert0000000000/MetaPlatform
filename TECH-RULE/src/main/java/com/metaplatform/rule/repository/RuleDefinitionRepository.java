package com.metaplatform.rule.repository;

import com.metaplatform.rule.entity.RuleDefinitionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RuleDefinitionRepository extends JpaRepository<RuleDefinitionEntity, String> {

    Optional<RuleDefinitionEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndRulesetIdAndCodeAndDeletedFalse(String tenantId, String rulesetId, String code);

    Page<RuleDefinitionEntity> findByTenantIdAndRulesetIdAndDeletedFalse(String tenantId, String rulesetId, Pageable pageable);

    List<RuleDefinitionEntity> findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
            String tenantId, String rulesetId);

    long countByTenantIdAndRulesetIdAndDeletedFalse(String tenantId, String rulesetId);
}
