package com.metaplatform.action.orchestration.repository;

import com.metaplatform.action.orchestration.entity.OrchestrationExecutionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrchestrationExecutionRepository extends JpaRepository<OrchestrationExecutionEntity, UUID> {

    Optional<OrchestrationExecutionEntity> findByTenantIdAndExecutionId(String tenantId, String executionId);

    Page<OrchestrationExecutionEntity> findByTenantIdAndOrchestrationIdOrderByStartedAtDesc(String tenantId, String orchestrationId, Pageable pageable);
}
