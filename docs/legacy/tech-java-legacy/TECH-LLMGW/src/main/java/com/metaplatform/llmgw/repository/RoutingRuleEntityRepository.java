package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.RoutingRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoutingRuleEntityRepository extends JpaRepository<RoutingRuleEntity, Long> {

    List<RoutingRuleEntity> findByIsActive(Boolean isActive);

    List<RoutingRuleEntity> findByIsActiveTrueOrderByPriorityDesc();
}
