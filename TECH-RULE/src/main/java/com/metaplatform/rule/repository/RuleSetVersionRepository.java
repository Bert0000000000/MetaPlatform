package com.metaplatform.rule.repository;

import com.metaplatform.rule.entity.RuleSetVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RuleSetVersionRepository extends JpaRepository<RuleSetVersionEntity, String> {

    List<RuleSetVersionEntity> findByTenantIdAndRulesetIdOrderByVersionNumberDesc(String tenantId, String rulesetId);

    Optional<RuleSetVersionEntity> findByIdAndTenantId(String id, String tenantId);

    Optional<RuleSetVersionEntity> findTopByTenantIdAndRulesetIdOrderByVersionNumberDesc(String tenantId, String rulesetId);
}
