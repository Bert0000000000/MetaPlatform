package com.metaplatform.ont.action;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActionRepository extends JpaRepository<ActionEntity, String> {

    Optional<ActionEntity> findByTenantIdAndActionCode(String tenantId, String actionCode);

    List<ActionEntity> findByTenantIdAndTargetConceptCodeAndEnabledTrue(String tenantId, String conceptCode);

    List<ActionEntity> findByTenantIdAndRiskLevelAndEnabledTrue(String tenantId, String riskLevel);
}
