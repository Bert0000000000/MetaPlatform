package com.metaplatform.agent.artifact;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArtifactService {

    private final ArtifactRepository repository;

    @Value("${mate.artifact.bucket:metaplatform-artifacts}")
    private String defaultBucket;

    public ArtifactEntity record(String tenantId, String runId, String agentId,
                                  String kind, String displayName, String storageKey,
                                  String mimeType, Long byteSize, String metadata) {
        ArtifactEntity a = ArtifactEntity.builder()
                .id("ART-" + UUID.randomUUID())
                .tenantId(tenantId == null ? "tenant-default" : tenantId)
                .runId(runId)
                .agentId(agentId)
                .artifactKind(kind == null ? "FILE" : kind)
                .displayName(displayName)
                .storageBucket(defaultBucket)
                .storageKey(storageKey)
                .mimeType(mimeType)
                .byteSize(byteSize)
                .metadata(metadata)
                .createdAt(Instant.now())
                .build();
        ArtifactEntity saved = repository.save(a);
        log.info("[ArtifactService] recorded artifact id={} runId={} key={}", saved.getId(), runId, storageKey);
        return saved;
    }

    public List<ArtifactEntity> listByRun(String runId) {
        return repository.findByRunId(runId);
    }
}
