package com.metaplatform.rule.testcase.repository;

import com.metaplatform.rule.testcase.entity.TestCaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCaseEntity, String> {

    List<TestCaseEntity> findByTenantIdAndRulesetId(String tenantId, String rulesetId);

    List<TestCaseEntity> findByTenantIdAndTargetTypeAndTargetId(String tenantId, String targetType, String targetId);

    List<TestCaseEntity> findByTenantId(String tenantId);

    long countByTenantIdAndStatus(String tenantId, String status);
}
