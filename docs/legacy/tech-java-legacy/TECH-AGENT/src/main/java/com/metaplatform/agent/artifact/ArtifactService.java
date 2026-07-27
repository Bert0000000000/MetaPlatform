package com.metaplatform.agent.artifact;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.artifact.dto.AgentArtifactDto;
import com.metaplatform.agent.artifact.dto.SignedUrlResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArtifactService {
    private final ArtifactRepository repository;
    private final ObjectMapper objectMapper;

    @Value("${mate.artifact.bucket:metaplatform-artifacts}") private String defaultBucket;
    @Value("${mate.artifact.signed-url-base:http://localhost:9000}") private String signedUrlBase;

    @Transactional
    public ArtifactEntity record(String tenantId, String runId, String agentId, String kind, String displayName,
                                 String storageKey, String mimeType, Long byteSize, String metadata) {
        Instant now = Instant.now();
        ArtifactEntity a = ArtifactEntity.builder().id("ART-" + UUID.randomUUID().toString().replace("-", ""))
                .tenantId(tenantId == null ? "tenant-default" : tenantId).runId(runId).agentId(agentId)
                .artifactKind(kind == null ? "FILE" : kind).displayName(displayName).storageBucket(defaultBucket)
                .storageKey(storageKey).mimeType(mimeType).byteSize(byteSize).metadata(metadata).createdAt(now)
                .scanStatus("CLEAN").revoked(false).build();
        return repository.save(a);
    }

    @Transactional
    public List<AgentArtifactDto> listByRun(String runId) {
        return repository.findByRunId(runId).stream().map(this::enforceBlockedInvariant).map(this::toDto).toList();
    }

    @Transactional
    public SignedUrlResponse signedUrl(String artifactId) {
        ArtifactEntity artifact = repository.findById(artifactId).orElseThrow(() ->
                Phase1Exception.notFound("ARTIFACT_NOT_FOUND", "Artifact not found: " + artifactId));
        enforceBlockedInvariant(artifact);
        if (artifact.isRevoked() || "BLOCKED".equals(artifact.getScanStatus())) {
            throw Phase1Exception.gone("ARTIFACT_REVOKED", "Artifact signed URL has been revoked");
        }
        Instant now = Instant.now();
        if (artifact.getExpiresAt() != null && !artifact.getExpiresAt().isAfter(now)) {
            throw Phase1Exception.gone("ARTIFACT_EXPIRED", "Artifact has expired");
        }
        Instant expiresAt = now.plusSeconds(3600);
        artifact.setSignedUrl(signedUrlBase + "/" + artifact.getStorageBucket() + "/" + artifact.getStorageKey());
        artifact.setSignedUrlExpiresAt(expiresAt);
        repository.save(artifact);
        return new SignedUrlResponse(artifact.getSignedUrl(), expiresAt);
    }

    private ArtifactEntity enforceBlockedInvariant(ArtifactEntity artifact) {
        if ("BLOCKED".equals(artifact.getScanStatus()) && !artifact.isRevoked()) {
            artifact.setRevoked(true); artifact.setRevokedAt(Instant.now()); artifact.setRevokedReason("scan status BLOCKED");
            artifact.setSignedUrl(null); artifact.setSignedUrlExpiresAt(null); repository.save(artifact);
        }
        return artifact;
    }

    private AgentArtifactDto toDto(ArtifactEntity a) {
        return AgentArtifactDto.builder().artifactId(a.getId()).runId(a.getRunId()).tenantId(a.getTenantId())
                .filename(a.getDisplayName()).contentType(a.getMimeType()).sizeBytes(a.getByteSize()).sha256(a.getSha256())
                .minioKey(a.getStorageKey()).scanStatus(a.getScanStatus()).flaggedReasons(readList(a.getFlaggedReasons()))
                .producedBy(producedBy(a))
                .evidenceRefs(readList(a.getEvidenceRefs())).createdAt(a.getCreatedAt()).expiresAt(a.getExpiresAt())
                .signedUrl(a.getSignedUrl()).revoked(a.isRevoked()).build();
    }
    private Map<String,Object> producedBy(ArtifactEntity a) {
        Map<String,Object> value = new LinkedHashMap<>();
        value.put("agentId", Optional.ofNullable(a.getAgentId()).orElse("unknown"));
        value.put("skillId", a.getProducedBySkillId());
        value.put("toolCallId", null);
        return value;
    }
    private List<String> readList(String value) { if (value == null || value.isBlank()) return List.of(); try { return objectMapper.readValue(value, new TypeReference<>() {}); } catch (Exception e) { return List.of(); } }
}
