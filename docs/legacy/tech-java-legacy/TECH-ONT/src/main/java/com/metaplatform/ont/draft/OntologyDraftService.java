package com.metaplatform.ont.draft;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.diff.VersionDiffEntity;
import com.metaplatform.ont.diff.VersionDiffService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.metaplatform.msg.topology.TopologyTopics;

/**
 * Ontology Draft / Commit Service（P1.3）。
 *
 * <p>提供：</p>
 * <ul>
 *   <li>{@link #proposeDraft}：把候选事实包装为草稿</li>
 *   <li>{@link #approveDraft}：Reviewer 通过</li>
 *   <li>{@link #rejectDraft}：Reviewer 拒绝</li>
 *   <li>{@link #publishDraft}：把草稿 Commit 到 Ontology，生成新版本</li>
 *   <li>{@link #rollback}：回滚到指定版本（落 VersionDiff）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyDraftService {

    private final OntologyDraftRepository draftRepository;
    private final CandidateFactRepository candidateRepository;
    private final OntologyValidator validator;
    private final VersionDiffService versionDiffService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public OntologyDraftEntity proposeDraft(ProposeDraftRequest request) {
        OntologyDraftEntity draft = OntologyDraftEntity.builder()
                .id("DRAFT-" + UUID.randomUUID())
                .tenantId(request.tenantId)
                .baseVersion(request.baseVersion)
                .targetVersion(request.targetVersion)
                .draftKind(request.draftKind)
                .source(request.source)
                .sourceRunId(request.sourceRunId)
                .summary(request.summary)
                .status(OntologyDraftEntity.Status.DRAFT.name())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        draft = draftRepository.save(draft);

        for (ProposeDraftRequest.CandidateInput c : request.candidates) {
            CandidateFactEntity fact = CandidateFactEntity.builder()
                    .id("CF-" + UUID.randomUUID())
                    .draftId(draft.getId())
                    .conceptCode(c.conceptCode)
                    .objectId(c.objectId)
                    .property(c.property)
                    .proposedValue(c.proposedValue == null ? null : c.proposedValue.toString())
                    .evidenceRefs(c.evidenceRefs == null ? null : c.evidenceRefs.toString())
                    .confidence(c.confidence)
                    .conflictLevel(c.conflictLevel == null ? "NONE" : c.conflictLevel)
                    .decision(CandidateFactEntity.Decision.PENDING.name())
                    .build();
            candidateRepository.save(fact);
        }

        // 触发校验（默认 DRAFT 状态；冲突级别由 Validator 决定）
        List<CandidateFactEntity> facts = candidateRepository.findByDraftId(draft.getId());
        OntologyValidator.DraftValidationReport report = validator.validateDraft(draft, facts);
        log.info("[OntologyDraftService] proposed draftId={} total={} accepted={} rejected={} high={}",
                draft.getId(), report.totalCount(), report.accepted(), report.rejected(), report.highConflict());

        if (report.canAutoCommit() && "USER".equals(request.source)) {
            // 用户直接起草且无冲突 → 可自动走审批
            draft.setStatus(OntologyDraftEntity.Status.PENDING_REVIEW.name());
            draft.setUpdatedAt(Instant.now());
            draftRepository.save(draft);
        }

        return draft;
    }

    @Transactional
    public OntologyDraftEntity approveDraft(String draftId, String reviewer) {
        OntologyDraftEntity draft = draftRepository.findById(draftId).orElseThrow();
        draft.setStatus(OntologyDraftEntity.Status.APPROVED.name());
        draft.setReviewer(reviewer);
        draft.setReviewedAt(Instant.now());
        draft.setUpdatedAt(Instant.now());
        return draftRepository.save(draft);
    }

    @Transactional
    public OntologyDraftEntity rejectDraft(String draftId, String reviewer, String reason) {
        OntologyDraftEntity draft = draftRepository.findById(draftId).orElseThrow();
        draft.setStatus(OntologyDraftEntity.Status.REJECTED.name());
        draft.setReviewer(reviewer);
        draft.setReviewedAt(Instant.now());
        draft.setRejectionReason(reason);
        draft.setUpdatedAt(Instant.now());
        return draftRepository.save(draft);
    }

    @Transactional
    public OntologyDraftEntity publishDraft(String draftId, String approver) {
        OntologyDraftEntity draft = draftRepository.findById(draftId).orElseThrow();
        if (!OntologyDraftEntity.Status.APPROVED.name().equals(draft.getStatus())
                && !OntologyDraftEntity.Status.DRAFT.name().equals(draft.getStatus())) {
            throw new IllegalStateException("草稿状态不可发布: " + draft.getStatus());
        }
        // 记录 VersionDiff
        List<CandidateFactEntity> facts = candidateRepository.findByDraftId(draftId);
        versionDiffService.record(draft.getTenantId(), draft.getBaseVersion(), draft.getTargetVersion(),
                VersionDiffEntity.DiffType.OBJECT_CHANGED, facts);

        draft.setStatus(OntologyDraftEntity.Status.COMMITTED.name());
        draft.setReviewer(approver);
        draft.setReviewedAt(Instant.now());
        draft.setCommittedAt(Instant.now());
        draft.setUpdatedAt(Instant.now());
        OntologyDraftEntity saved = draftRepository.save(draft);

        // 发布 Ontology Commit 事件
        kafkaTemplate.send(TopologyTopics.ONTOLOGY_COMMIT_PUBLISHED, draft.getTargetVersion(), saved);
        log.info("[OntologyDraftService] committed draftId={} version={}", draftId, draft.getTargetVersion());
        return saved;
    }

    @Transactional
    public boolean rollback(String tenantId, String fromVersion, String toVersion, String operator) {
        versionDiffService.record(tenantId, fromVersion, toVersion,
                VersionDiffEntity.DiffType.OBJECT_CHANGED,
                Map.of("rollback", true, "operator", operator, "from", fromVersion, "to", toVersion));
        log.warn("[OntologyDraftService] rollback tenant={} from={} to={} operator={}",
                tenantId, fromVersion, toVersion, operator);
        return true;
    }

    public List<OntologyDraftEntity> listByStatus(String tenantId, String status) {
        return draftRepository.findByTenantIdAndStatusOrderByUpdatedAtDesc(tenantId, status);
    }

    public OntologyDraftEntity get(String draftId) {
        return draftRepository.findById(draftId).orElseThrow();
    }

    public List<CandidateFactEntity> candidates(String draftId) {
        return candidateRepository.findByDraftId(draftId);
    }

    /**
     * 入参 DTO。
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ProposeDraftRequest {
        private String tenantId;
        private String runId;  // optional: 关联 agent run 产生的 draft
        private String baseVersion;
        private String targetVersion;
        private String draftKind;
        private String source;            // USER / AGENT / SYSTEM
        private String sourceRunId;
        private String summary;
        private List<CandidateInput> candidates;

        @lombok.Data
        @lombok.NoArgsConstructor
        @lombok.AllArgsConstructor
        public static class CandidateInput {
            private String conceptCode;
            private String objectId;
            private String property;
            private Object proposedValue;
            private java.util.List<String> evidenceRefs;
            private double confidence;
            private String conflictLevel;
        }
    }
}
