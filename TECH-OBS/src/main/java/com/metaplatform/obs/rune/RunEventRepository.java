package com.metaplatform.obs.rune;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RunEventRepository extends JpaRepository<RunEventEntity, String> {
    List<RunEventEntity> findByRunIdOrderByTsAsc(String runId);
    List<RunEventEntity> findByTenantIdAndTypeAndTsBetween(String tenantId, String type, java.time.Instant from, java.time.Instant to);
}
