package com.metaplatform.agent.scheduled;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ScheduledAgentRepository extends JpaRepository<ScheduledAgentEntity, String> {
    List<ScheduledAgentEntity> findByEnabledTrueAndNextRunAtLessThanEqual(Instant ts);
    List<ScheduledAgentEntity> findByTenantIdAndAgentId(String tenantId, String agentId);
}
