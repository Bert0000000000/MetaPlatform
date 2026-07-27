package com.metaplatform.ont.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DomainEventRepository extends JpaRepository<DomainEventEntity, String> {

    List<DomainEventEntity> findByTenantIdAndEventCodeOrderByOccurredAtDesc(String tenantId, String eventCode);

    List<DomainEventEntity> findByTenantIdAndConsumedFalse(String tenantId);
}
