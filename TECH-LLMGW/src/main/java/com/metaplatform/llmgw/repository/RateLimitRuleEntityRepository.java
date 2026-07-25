package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.RateLimitRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RateLimitRuleEntityRepository extends JpaRepository<RateLimitRuleEntity, Long> {

    List<RateLimitRuleEntity> findByIsActive(Boolean isActive);

    List<RateLimitRuleEntity> findByScopeAndScopeKey(String scope, String scopeKey);

    List<RateLimitRuleEntity> findByModelId(String modelId);
}
