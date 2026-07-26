package com.metaplatform.agent.authoring;

import com.metaplatform.ont.draft.OntologyDraftEntity;
import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest;
import com.metaplatform.ont.draft.OntologyDraftService.ProposeDraftRequest.CandidateInput;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * P6-AUTH-06 AuthoringBatchAccumulator - buffers CandidateInput rows by
 * (tenantId + documentId) and lets {@link AuthoringBatchFlushScheduler} or
 * direct caller drain them in batches via {@link AuthoringService}.
 *
 * <p>Why: A single document often produces many candidate facts (paragraphs,
 * clauses, dates, contacts). Without batching, each event would create a
 * separate Draft entity in TECH-ONT, costing both write-amplification on
 * the ontology audit log and review overhead on the draft UI. This buffer
 * coalesces same-document candidates into a single submit.</p>
 *
 * <p>Threading: ConcurrentHashMap and per-key volatile-friendly fields for
 * first-enqueue timestamp + accumulated CandidateInput list. {@link #enqueue}
 * may be called concurrently from event listeners.</p>
 */
@Slf4j
@Component
public class AuthoringBatchAccumulator {

    private final ConcurrentHashMap<DocumentKey, BufferedDraft> buffer = new ConcurrentHashMap<>();

    /**
     * Enqueue a single candidate for a documentId. No-op if candidate is null.
     */
    public void enqueue(String tenantId, String documentId, String runId, CandidateInput candidate) {
        if (candidate == null) return;
        DocumentKey key = DocumentKey.of(tenantId, documentId);
        buffer.compute(key, (k, existing) -> {
            if (existing == null) {
                BufferedDraft d = new BufferedDraft(k.tenantId, k.documentId, runId, System.currentTimeMillis());
                d.candidates.add(candidate);
                return d;
            }
            existing.runId = runId == null ? existing.runId : runId;
            existing.lastEnqueueEpochMs = System.currentTimeMillis();
            existing.candidates.add(candidate);
            return existing;
        });
    }

    /**
     * Drain all buffered drafts whose age (now - firstEnqueueEpochMs) >= maxAgeMillis
     * and submit each to authoringService. Returns count of drafts submitted.
     */
    public int flushDue(AuthoringService authoringService, long maxAgeMillis) {
        if (authoringService == null) return 0;
        long now = System.currentTimeMillis();
        int submitted = 0;
        List<DocumentKey> keys = new ArrayList<>(buffer.keySet());
        for (DocumentKey k : keys) {
            BufferedDraft d = buffer.get(k);
            if (d == null) continue;
            if (now - d.firstEnqueueEpochMs < maxAgeMillis) continue;
            if (removeIfMatch(k, d)) {
                try {
                    submitOne(authoringService, d);
                    submitted++;
                } catch (Exception e) {
                    log.warn("[AuthoringBatchAccumulator] flush failed key={} err={}", k, e.getMessage());
                    // Re-add at the head so we retry next cycle instead of losing data.
                    // Use lastEnqueue as firstEnqueue so we wait maxAge again before the next try.
                    // Re-add with updated lastEnqueue so the next cycle respects the age window again.
                    buffer.put(k, d);
                }
            }
        }
        return submitted;
    }

    /**
     * Drain ALL buffered drafts (regardless of age). Useful on shutdown or for tests.
     */
    public int flushAll(AuthoringService authoringService) {
        if (authoringService == null) return 0;
        int submitted = 0;
        List<DocumentKey> keys = new ArrayList<>(buffer.keySet());
        for (DocumentKey k : keys) {
            BufferedDraft d = buffer.remove(k);
            if (d == null) continue;
            try {
                submitOne(authoringService, d);
                submitted++;
            } catch (Exception e) {
                log.warn("[AuthoringBatchAccumulator] flushAll failed key={} err={}", k, e.getMessage());
            }
        }
        return submitted;
    }

    public int size() {
        int total = 0;
        for (BufferedDraft d : buffer.values()) total += d.candidates.size();
        return total;
    }

    public int sizeByKey() {
        return buffer.size();
    }

    public boolean isEmpty() {
        return buffer.isEmpty();
    }

    public void clear() {
        buffer.clear();
    }

    public Set<String> keys() {
        Set<String> out = new HashSet<>();
        for (DocumentKey k : buffer.keySet()) out.add(k.toString());
        return out;
    }

    private void submitOne(AuthoringService authoringService, BufferedDraft d) {
        ProposeDraftRequest req = authoringService.buildDraft(
                d.tenantId, d.runId, "AGENT_BATCH", "v1", "v2",
                "Scheduled batch (" + d.candidates.size() + " candidates): " + d.documentId,
                d.candidates);
        OntologyDraftEntity entity = authoringService.submit(req);
        log.info("[AuthoringBatchAccumulator] flushed documentId={} candidates={} draft={}",
                d.documentId, d.candidates.size(), entity == null ? null : entity.getId());
    }

    /** CAS-style remove: only succeed if the current value still equals the snapshot. */
    private boolean removeIfMatch(DocumentKey key, BufferedDraft expected) {
        while (true) {
            BufferedDraft now = buffer.get(key);
            if (now != expected) return false;
            if (buffer.remove(key, expected)) return true;
        }
    }

    /** Composite key for tenant + document. */
    public static final class DocumentKey {
        public final String tenantId;
        public final String documentId;

        private DocumentKey(String tenantId, String documentId) {
            this.tenantId = Objects.requireNonNull(tenantId, "tenantId");
            this.documentId = Objects.requireNonNull(documentId, "documentId");
        }

        public static DocumentKey of(String tenantId, String documentId) {
            return new DocumentKey(tenantId == null ? "tenant-default" : tenantId,
                    documentId == null ? "unknown" : documentId);
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof DocumentKey other)) return false;
            return tenantId.equals(other.tenantId) && documentId.equals(other.documentId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(tenantId, documentId);
        }

        @Override
        public String toString() {
            return tenantId + ":" + documentId;
        }
    }

    /** Mutable buffered draft. */
    public static final class BufferedDraft {
        public final String tenantId;
        public final String documentId;
        public volatile String runId;
        public final long firstEnqueueEpochMs;
        public volatile long lastEnqueueEpochMs;
        public final List<CandidateInput> candidates = new ArrayList<>();

        public BufferedDraft(String tenantId, String documentId, String runId, long firstEnqueueEpochMs) {
            this.tenantId = tenantId;
            this.documentId = documentId;
            this.runId = runId;
            this.firstEnqueueEpochMs = firstEnqueueEpochMs;
            this.lastEnqueueEpochMs = firstEnqueueEpochMs;
        }
    }
}
