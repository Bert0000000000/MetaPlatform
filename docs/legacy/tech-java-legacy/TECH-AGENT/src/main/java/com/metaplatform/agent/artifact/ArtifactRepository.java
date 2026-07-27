package com.metaplatform.agent.artifact;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ArtifactRepository extends JpaRepository<ArtifactEntity, String> {
    List<ArtifactEntity> findByRunId(String runId);
    List<ArtifactEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId);
}
