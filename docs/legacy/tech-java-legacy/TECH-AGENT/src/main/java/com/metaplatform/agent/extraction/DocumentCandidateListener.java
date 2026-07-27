package com.metaplatform.agent.extraction;

import com.metaplatform.agent.authoring.AuthoringBatchAccumulator;
import com.metaplatform.agent.authoring.AuthoringService;
import com.metaplatform.ont.draft.OntologyDraftEntity;
import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest.CandidateInput;
import com.metaplatform.msg.consumer.EventEnvelope;
import com.metaplatform.msg.consumer.EventTopicListener;
import com.metaplatform.msg.topology.TopologyTopics;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * P6.3 DocumentCandidateListener - 订阅 kb.document.candidate.ready 事件，
 * 把 Document 抽取出的 Candidate Fact 通过 AuthoringService 写入 Ontology Draft。
 *
 * <p>事件负载结构（来自 TECH-RAG 抽取 pipeline）：
 * <pre>
 *   {
 *     "tenantId": "TENANT-01",
 *     "documentId": "DOC-CONTRACT-2026",
 *     "runId": "RUN-EXTRACTION-001",   // 关联的 Agent Run (如果有)
 *     "candidates": [
 *       { "conceptCode": "Contract", "objectId": "CONTRACT-1", "property": "amount",
 *         "value": "4800000", "evidenceRef": "DOC-CONTRACT-2026", "confidence": 0.95 }
 *     ]
 *   }
 * </pre>
 * </p>
 */
@Slf4j
@Service
public class DocumentCandidateListener {

    private final OntologyDraftService draftService;
    private final AuthoringService authoringService;
    private final AuthoringBatchAccumulator batchAccumulator;
    private final FlushMode flushMode;

    /**
     * Flush strategy for candidate fact events.
     * IMMEDIATE: each event triggers a draft submit (default).
     * BATCHED: enqueue into accumulator; flushAll on every event (still synchronous)
     * and also picked up by AuthoringBatchFlushScheduler on a schedule.
     */
    public enum FlushMode { IMMEDIATE, BATCHED }

    @Autowired
    public DocumentCandidateListener(
            @Autowired(required = false) OntologyDraftService draftService,
            @Autowired(required = false) AuthoringService authoringService,
            @Autowired(required = false) AuthoringBatchAccumulator batchAccumulator,
            @Autowired(required = false) FlushMode flushMode) {
        this.draftService = draftService;
        this.authoringService = authoringService;
        this.batchAccumulator = batchAccumulator;
        this.flushMode = flushMode == null ? FlushMode.IMMEDIATE : flushMode;
    }

    @EventTopicListener(
            topics = TopologyTopics.DOCUMENT_CANDIDATE_READY,
            group = "ont-draft-writer",
            concurrency = 1,
            retries = 3,
            dlq = true
    )
    public void onCandidateReady(EventEnvelope<Map<String, Object>> envelope) {
        Map<String, Object> payload = envelope.payload();
        if (payload == null) {
            log.warn("[DocumentCandidateListener] empty payload, skipping event={}", envelope.eventId());
            return;
        }
        log.info("[DocumentCandidateListener] event={} payload-keys={}",
                envelope.eventId(), payload.keySet());

        String tenantId = stringOr(payload.get("tenantId"), "tenant-default");
        String runId = stringOr(payload.get("runId"), null);
        String documentId = stringOr(payload.get("documentId"), "unknown");
        Object candidatesRaw = payload.get("candidates");
        if (!(candidatesRaw instanceof List<?>)) {
            log.warn("[DocumentCandidateListener] documentId={} missing candidates, skipping", documentId);
            return;
        }
        int size = ((List<?>) candidatesRaw).size();
        log.info("[DocumentCandidateListener] documentId={} candidateCount={}", documentId, size);

        if (authoringService == null) {
            log.warn("[DocumentCandidateListener] AuthoringService unavailable, documentId={} not submitted", documentId);
            return;
        }
        // P6-AUTH-06: in BATCHED mode, route through accumulator for coalesced submits.
        if (flushMode == FlushMode.BATCHED && batchAccumulator != null) {
            int buffered = 0;
            for (Object o : ((List<?>) candidatesRaw)) {
                if (!(o instanceof Map<?, ?> m)) continue;
                CandidateInput ci = toCandidate(m);
                if (ci == null) continue;
                batchAccumulator.enqueue(tenantId, documentId, runId, ci);
                buffered++;
            }
            int flushed = batchAccumulator.flushAll(authoringService);
            log.info("[DocumentCandidateListener] BATCHED mode documentId={} buffered={} flushed={}",
                    documentId, buffered, flushed);
            return;
        }
        ProposeDraftRequest req = authoringService.buildFromExtraction(
                tenantId, runId, "v1", "v2",
                "Document extraction: " + documentId + " (" + size + " candidates)",
                payload);
        OntologyDraftEntity draft = authoringService.submit(req);
        if (draft != null) {
            log.info("[DocumentCandidateListener] documentId={} submitted draft={} for run={}",
                    documentId, draft.getId(), runId);
        }
    }

    /** Convert a Map payload row into a CandidateInput, mirroring AuthoringService.buildFromExtraction. */
    @SuppressWarnings("unchecked")
    private static CandidateInput toCandidate(Map<?, ?> m) {
        CandidateInput c = new CandidateInput();
        c.setConceptCode(m.get("conceptCode") == null ? null : String.valueOf(m.get("conceptCode")));
        c.setObjectId(m.get("objectId") == null ? null : String.valueOf(m.get("objectId")));
        c.setProperty(m.get("property") == null ? null : String.valueOf(m.get("property")));
        c.setProposedValue(m.get("value"));
        Object refs = m.get("evidenceRef");
        if (refs == null) refs = m.get("evidenceRefs");
        if (refs instanceof java.util.List<?> refList) {
            java.util.List<String> refStrs = new java.util.ArrayList<>();
            for (Object r : refList) refStrs.add(String.valueOf(r));
            c.setEvidenceRefs(refStrs);
        } else if (refs instanceof String refStr) {
            c.setEvidenceRefs(java.util.List.of(refStr));
        } else {
            c.setEvidenceRefs(java.util.List.of());
        }
        Object conf = m.get("confidence");
        double cd = 0.5d;
        if (conf instanceof Number n) cd = n.doubleValue();
        else if (conf instanceof String s) {
            try { cd = Double.parseDouble(s); } catch (NumberFormatException ignored) {}
        }
        c.setConfidence(cd);
        Object cl = m.get("conflictLevel");
        c.setConflictLevel(cl == null ? "NONE" : String.valueOf(cl));
        return c;
    }

    /** Static accessor so an integration test or external wiring can supply a FlushMode by name. */
    public static FlushMode flushMode(String name) {
        if (name == null) return FlushMode.IMMEDIATE;
        try { return FlushMode.valueOf(name.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return FlushMode.IMMEDIATE; }
    }

    /** Test-friendly accessor. */
    public FlushMode getFlushMode() { return flushMode; }

    private static String stringOr(Object o, String def) {
        return o == null ? def : String.valueOf(o);
    }
}
