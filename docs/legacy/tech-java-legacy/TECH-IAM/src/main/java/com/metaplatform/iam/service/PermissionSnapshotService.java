package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.snapshot.PermissionSnapshotDto;
import com.metaplatform.iam.entity.PermissionSnapshotEntity;
import com.metaplatform.iam.permission.PermissionResolverService;
import com.metaplatform.iam.repository.PermissionSnapshotRepository;
import com.metaplatform.iam.security.SnapshotSigner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * PermissionSnapshot 服务（P0.2.1 / P1.2.3 核心实现）。
 *
 * <p>职责：</p>
 * <ol>
 *   <li>聚合 PermissionResolverService 的多维度权限解析结果</li>
 *   <li>签名 + 持久化快照（5 分钟 TTL）</li>
 *   <li>提供 buildSnapshot / getSnapshot / verifySnapshot 三个 API</li>
 * </ol>
 *
 * <p>下游 Consumer（TECH-AGENT / TECH-ONT / DeerFlow Adapter）通过
 * getSnapshot 获取授权后的快照 ID，写入 OntologyContextEnvelope。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionSnapshotService {

    private static final long DEFAULT_TTL_SECONDS = 300L;   // 5 分钟

    private final PermissionSnapshotRepository repository;
    private final PermissionResolverService resolver;
    private final ObjectMapper objectMapper;

    @Value("${mate.iam.snapshot.secret:metaplatform-dev-snapshot-secret-2026}")
    private String snapshotSecret;

    @Value("${mate.iam.snapshot.ttl-seconds:300}")
    private long ttlSeconds;

    private SnapshotSigner signer;

    private SnapshotSigner signer() {
        if (signer == null) {
            signer = new SnapshotSigner(snapshotSecret);
        }
        return signer;
    }

    /**
     * 构建并持久化快照。返回快照 ID。
     *
     * @param tenantId     租户
     * @param userId       用户
     * @param conceptCode  业务对象类型
     * @param objectId     业务对象 ID
     * @param candidates   候选 Action / Relation / Metric 列表
     */
    @Transactional
    public String buildSnapshot(String tenantId, String userId, String conceptCode,
                                 String objectId, SnapshotCandidates candidates) {
        PermissionSnapshotDto dto = PermissionSnapshotDto.builder()
                .dataScope(scopeString(tenantId, userId, conceptCode))
                .rowFilter(rowFilterString(tenantId, userId, conceptCode))
                .deniedFields(resolver.resolveFieldMask(tenantId, userId, conceptCode))
                .allowedRelations(resolver.filterRelatedObjects(tenantId, userId, conceptCode,
                        candidates.getCandidateRelations()))
                .allowedActions(resolver.resolveAllowedActions(tenantId, userId, candidates.getCandidateActions()))
                .approvalRequiredActions(resolver.resolveApprovalRequiredActions(tenantId, userId))
                .concepts(candidates.getConcepts())
                .metrics(candidates.getMetrics())
                .regions(candidates.getRegions())
                .build();

        String snapshotJson;
        try {
            snapshotJson = objectMapper.writeValueAsString(dto);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("snapshot 序列化失败", e);
        }

        Instant expiresAt = Instant.now().plusSeconds(ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS);
        String signature = signer().sign(tenantId, userId, conceptCode, objectId,
                snapshotJson, expiresAt.toEpochMilli());

        String snapshotId = "SNAP-" + UUID.randomUUID();
        PermissionSnapshotEntity entity = PermissionSnapshotEntity.builder()
                .id(snapshotId)
                .tenantId(tenantId)
                .userId(userId)
                .subjectConcept(conceptCode)
                .subjectId(objectId)
                .snapshotData(snapshotJson)
                .signature(signature)
                .expiresAt(expiresAt)
                .revoked(false)
                .createdAt(Instant.now())
                .build();
        repository.save(entity);
        log.debug("[PermissionSnapshot] built snapshotId={} tenant={} user={} concept={} object={}",
                snapshotId, tenantId, userId, conceptCode, objectId);
        return snapshotId;
    }

    /**
     * 读取快照并校验签名与有效期。
     */
    @Transactional(readOnly = true)
    public Optional<PermissionSnapshotDto> getSnapshot(String snapshotId) {
        Optional<PermissionSnapshotEntity> opt = repository.findById(snapshotId);
        if (opt.isEmpty()) return Optional.empty();
        PermissionSnapshotEntity e = opt.get();
        if (e.isRevoked() || e.getExpiresAt().isBefore(Instant.now())) {
            return Optional.empty();
        }
        boolean ok = signer().verify(e.getTenantId(), e.getUserId(), e.getSubjectConcept(),
                e.getSubjectId(), e.getSnapshotData(), e.getExpiresAt().toEpochMilli(), e.getSignature());
        if (!ok) {
            log.warn("[PermissionSnapshot] signature mismatch snapshotId={} tenant={} user={}",
                    snapshotId, e.getTenantId(), e.getUserId());
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(e.getSnapshotData(), PermissionSnapshotDto.class));
        } catch (JsonProcessingException ex) {
            log.warn("[PermissionSnapshot] 反序列化失败 snapshotId={}", snapshotId, ex);
            return Optional.empty();
        }
    }

    /**
     * 撤销过期快照（定时任务调用）。
     */
    @Transactional
    public int revokeExpired() {
        return repository.revokeExpired(Instant.now());
    }

    private String scopeString(String tenantId, String userId, String conceptCode) {
        return resolver.resolveDataScope(tenantId, userId, java.util.Collections.emptyList(), conceptCode)
                .getDataScope().name();
    }

    private String rowFilterString(String tenantId, String userId, String conceptCode) {
        return resolver.resolveDataScope(tenantId, userId, java.util.Collections.emptyList(), conceptCode)
                .getRowFilter();
    }

    /**
     * 快照构建所需的候选列表。
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class SnapshotCandidates {
        private List<String> candidateActions;
        private List<String> candidateRelations;
        private List<String> concepts;
        private List<String> metrics;
        private List<String> regions;
    }
}
