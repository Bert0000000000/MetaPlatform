package com.metaplatform.agent.authoring;

import com.metaplatform.ont.draft.OntologyDraftEntity;
import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest;
import com.metaplatform.agent.clients.RAGClient;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest.CandidateInput;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * P6.2 AuthoringService - TECH-AGENT -> TECH-ONT Authoring pipeline glue.
 */
@Slf4j
@Service
public class AuthoringService {

    private final OntologyDraftService draftService;
    private final RAGClient ragClient;

    @Autowired
    public AuthoringService(@Autowired(required = false) OntologyDraftService draftService) {
        this(draftService, null);
    }

    @Autowired
    public AuthoringService(
            @Autowired(required = false) OntologyDraftService draftService,
            @Autowired(required = false) RAGClient ragClient) {
        this.draftService = draftService;
        this.ragClient = ragClient;
    }

    public ProposeDraftRequest buildDraft(String tenantId, String runId, String source,
                                          String baseVersion, String targetVersion, String summary,
                                          List<CandidateInput> candidates) {
        return ProposeDraftRequest.builder()
                .tenantId(tenantId == null ? "tenant-default" : tenantId)
                .runId(runId)
                .source(source == null ? "AGENT" : source)
                .baseVersion(baseVersion == null ? "v1" : baseVersion)
                .targetVersion(targetVersion == null ? "v2" : targetVersion)
                .summary(summary == null ? "Agent Run extraction" : summary)
                .candidates(candidates == null ? List.of() : candidates)
                .build();
    }

    @SuppressWarnings("unchecked")
    public ProposeDraftRequest buildFromExtraction(String tenantId, String runId, String baseVersion,
                                                  String targetVersion, String summary,
                                                  Map<String, Object> extraction) {
        if (extraction == null) return buildDraft(tenantId, runId, "AGENT", baseVersion, targetVersion, summary, List.of());
        Object raw = extraction.get("candidates");
        if (!(raw instanceof List<?> rawList)) {
            return buildDraft(tenantId, runId, "AGENT", baseVersion, targetVersion, summary, List.of());
        }
        List<CandidateInput> inputs = new ArrayList<>();
        for (Object o : rawList) {
            if (!(o instanceof Map<?, ?> m)) continue;
            CandidateInput c = new CandidateInput();
            c.setConceptCode(stringOr(m.get("conceptCode"), null));
            c.setObjectId(stringOr(m.get("objectId"), null));
            c.setProperty(stringOr(m.get("property"), null));
            c.setProposedValue(m.get("value"));
            Object refs = m.get("evidenceRef");
            if (refs == null) refs = m.get("evidenceRefs");
            if (refs instanceof List<?> refList) {
                List<String> refStrs = new ArrayList<>();
                for (Object r : refList) refStrs.add(String.valueOf(r));
                c.setEvidenceRefs(refStrs);
            } else if (refs instanceof String refStr) {
                c.setEvidenceRefs(List.of(refStr));
            } else {
                c.setEvidenceRefs(List.of());
            }
            c.setConfidence(numberOr(m.get("confidence"), 0.5));
            c.setConflictLevel(stringOr(m.get("conflictLevel"), "NONE"));
            inputs.add(c);
        }
        return buildDraft(tenantId, runId, "AGENT", baseVersion, targetVersion, summary, inputs);
    }

    public OntologyDraftEntity submit(ProposeDraftRequest request) {
        if (draftService == null) {
            log.warn("[AuthoringService] OntologyDraftService unavailable; skipping submit run={}", request.getRunId());
            return null;
        }
        try {
            OntologyDraftEntity draft = draftService.proposeDraft(request);
            log.info("[AuthoringService] submitted draft={} for run={} source={} candidates={}",
                    draft.getId(), request.getRunId(), request.getSource(),
                    request.getCandidates() == null ? 0 : request.getCandidates().size());
            return draft;
        } catch (Exception e) {
            log.error("[AuthoringService] submit failed run={}: {}", request.getRunId(), e.getMessage());
            throw e;
        }
    }

    /**
     * P2-RAG-04 - end-to-end authoring with RAG backfill.
     *
     * <p>For every candidate that lacks evidenceRefs, RAG search is triggered using
     * the candidate concept+property (or runId topic) as the query, and the resulting
     * document references are attached as evidence. The draft is then submitted as
     * usual.</p>
     *
     * <p>If no RAGClient is wired, this falls back to {@link #submit(ProposeDraftRequest)}
     * without backfill.</p>
     */
    public OntologyDraftEntity submitWithRagBackfill(ProposeDraftRequest request, int topK) {
        if (ragClient == null) {
            log.warn("[AuthoringService] no RAGClient wired; backfill skipped run={}", request.getRunId());
            return submit(request);
        }
        java.util.List<CandidateInput> originals = request.getCandidates();
        if (originals == null || originals.isEmpty()) return submit(request);
        java.util.List<CandidateInput> backfilled = new java.util.ArrayList<>(originals.size());
        for (CandidateInput c : originals) {
            if (c == null) continue;
            if (c.getEvidenceRefs() != null && !c.getEvidenceRefs().isEmpty()) {
                backfilled.add(c);
                continue;
            }
            String query = buildCandidateQuery(c);
            try {
                java.util.List<java.util.Map<String, Object>> hits = ragClient.search(
                        query, java.util.List.of(), topK,
                        request.getTenantId(), request.getRunId());
                java.util.List<String> refs = new java.util.ArrayList<>();
                for (java.util.Map<String, Object> hit : hits) {
                    if (hit == null) continue;
                    Object src = hit.get("source");
                    Object docId = hit.get("id");
                    if (src != null) refs.add(String.valueOf(src));
                    else if (docId != null) refs.add(String.valueOf(docId));
                }
                c.setEvidenceRefs(refs);
                log.info("[AuthoringService] backfill candidate concept={} property={} -> {} refs",
                        c.getConceptCode(), c.getProperty(), refs.size());
            } catch (Exception e) {
                log.warn("[AuthoringService] RAG backfill failed for concept={} property={}: {}",
                        c.getConceptCode(), c.getProperty(), e.getMessage());
            }
            backfilled.add(c);
        }
        request.setCandidates(backfilled);
        return submit(request);
    }

    private static String buildCandidateQuery(CandidateInput c) {
        StringBuilder sb = new StringBuilder();
        if (c.getConceptCode() != null) sb.append(c.getConceptCode());
        if (c.getProperty() != null) sb.append(" ").append(c.getProperty());
        if (c.getProposedValue() != null) sb.append(" ").append(c.getProposedValue());
        return sb.length() == 0 ? "unknown" : sb.toString();
    }

    private static String stringOr(Object o, String def) {
        return o == null ? def : String.valueOf(o);
    }

    private static double numberOr(Object o, double def) {
        if (o instanceof Number n) return n.doubleValue();
        if (o instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException ignored) { return def; }
        }
        return def;
    }
}
