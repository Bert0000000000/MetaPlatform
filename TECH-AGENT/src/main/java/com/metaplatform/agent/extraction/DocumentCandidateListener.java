package com.metaplatform.agent.extraction;

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

    @Autowired
    public DocumentCandidateListener(
            @Autowired(required = false) OntologyDraftService draftService,
            @Autowired(required = false) AuthoringService authoringService) {
        this.draftService = draftService;
        this.authoringService = authoringService;
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

    private static String stringOr(Object o, String def) {
        return o == null ? def : String.valueOf(o);
    }
}
