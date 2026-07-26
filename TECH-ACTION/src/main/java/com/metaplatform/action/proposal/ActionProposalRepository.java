package com.metaplatform.action.proposal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActionProposalRepository extends JpaRepository<ActionProposalEntity, String> {
    List<ActionProposalEntity> findByRunId(String runId);
    List<ActionProposalEntity> findByTenantIdAndStatus(String tenantId, String status);
    Optional<ActionProposalEntity> findByTenantIdAndIdempotencyKey(String tenantId, String idempotencyKey);
}
