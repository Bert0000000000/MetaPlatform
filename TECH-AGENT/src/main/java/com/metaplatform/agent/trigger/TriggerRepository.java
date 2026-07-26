package com.metaplatform.agent.trigger;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TriggerRepository extends JpaRepository<TriggerEntity, String> {
    List<TriggerEntity> findByEnabledTrueAndEventTopic(String eventTopic);
    List<TriggerEntity> findByTenantId(String tenantId);
}
