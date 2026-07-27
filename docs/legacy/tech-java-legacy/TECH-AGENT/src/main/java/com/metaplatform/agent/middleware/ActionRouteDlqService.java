package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.agent.action.dto.ActionProposalCreateRequest;
import com.metaplatform.agent.action.dto.ActionProposalDto;
import com.metaplatform.ont.draft.OntologyDraftService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * P5.6 ActionRouteDlqService - retry + dead-letter for failed auto-routes.
 *
 * <p>When the {@link OntologyActionGuardMiddleware} auto-route to WFE fails
 * (e.g. WFE down, network timeout), the failed proposal is captured here
 * for later retry. Operators can:
 * <ul>
 *   <li>Inspect {@link #getPending()} to see all queued failures</li>
 *   <li>Call {@link #retryAll()} to re-attempt each one</li>
 *   <li>Call {@link #retry(String)} for a specific failed proposal</li>
 *   <li>Call {@link #discard(String)} after manual intervention</li>
 * </ul>
 * </p>
 *
 * <p>Persistence: in-memory CopyOnWriteArrayList + idempotency-key dedup.
 * Production should add Flyway migration for DB persistence.</p>
 */
@Slf4j
@Service
public class ActionRouteDlqService {

    private final ActionProposalService proposalService;
    private final ActionRouteDlqRepository repository;
    private final ActionApprovalBridgeService approvalBridge;
    private final OntologyDraftService draftService;  // optional - only for cleanup hooks

    private ActionRouteDlqMetrics metrics;

    @Autowired
    public ActionRouteDlqService(
            @Autowired(required = false) ActionProposalService proposalService,
            @Autowired(required = false) ActionApprovalBridgeService approvalBridge,
            @Autowired(required = false) OntologyDraftService draftService,
            @Autowired(required = false) ActionRouteDlqRepository repository) {
        this.proposalService = proposalService;
        this.approvalBridge = approvalBridge;
        this.draftService = draftService;
        this.repository = repository;
    }

    public ActionRouteDlqMetrics getMetrics() { return metrics; }

    private final List<FailedRoute> pending = new CopyOnWriteArrayList<>();
    private final AtomicLong nextId = new AtomicLong(1);

    public record FailedRoute(
            long id,
            String runId,
            String proposalId,
            String actionCode,
            String riskLevel,
            String reason,
            long failedAtEpochMs,
            int retryCount
    ) {}

    /**
     * Enqueue a failed auto-route for later retry.
     */
    @Transactional
    public void enqueue(String runId, String proposalId, String actionCode,
                        String riskLevel, String reason) {
        long id = nextId.getAndIncrement();
        FailedRoute entry = new FailedRoute(id, runId, proposalId, actionCode, riskLevel,
                reason, System.currentTimeMillis(), 0);
        pending.add(entry);
        if (repository != null) {
            try {
                ActionRouteDlqEntity entity = ActionRouteDlqEntity.builder()
                        .id(entry.id()).tenantId(extractTenant(runId))
                        .runId(runId).proposalId(proposalId)
                        .actionCode(actionCode).riskLevel(riskLevel)
                        .reason(reason).failedAt(Instant.ofEpochMilli(entry.failedAtEpochMs()))
                        .retryCount(0).createdAt(Instant.now()).updatedAt(Instant.now())
                        .build();
                repository.save(entity);
            } catch (Exception e) {
                log.warn("[ActionRouteDLQ] DB persist failed (in-memory still kept): {}", e.getMessage());
            }
        }
        log.warn("[ActionRouteDLQ] enqueued id={} proposal={} action={} reason={}",
                id, proposalId, actionCode, reason);
        if (metrics != null) metrics.recordEnqueue();
    }

    /**
     * Retry a specific entry by id.
     * @return the new WFE task id, or null if still failed
     */
    @Transactional
    public String retry(long id) {
        FailedRoute entry = findById(id);
        if (entry == null) return null;
        if (repository != null) repository.incrementRetryCount(id, Instant.now());
        try {
            String wfeTaskId = approvalBridge.submitForApproval(entry.proposalId(), null);
            pending.remove(entry);
            if (repository != null) repository.markResolved(id, Instant.now(), "SUCCESS");
            log.info("[ActionRouteDLQ] retried id={} proposal={} -> wfeTask={}", id, entry.proposalId(), wfeTaskId);
            if (metrics != null) metrics.recordRetrySuccess();
            return wfeTaskId;
        } catch (Exception e) {
            if (repository != null) repository.markResolved(id, Instant.now(), "FAILED");
            log.warn("[ActionRouteDLQ] retry id={} still failed: {}", id, e.getMessage());
            if (metrics != null) metrics.recordRetryFailure();
            return null;
        }
    }

    /**
     * Retry all pending entries. Returns count of successful retries.
     */
    public int retryAll() {
        int ok = 0;
        for (FailedRoute entry : List.copyOf(pending)) {
            if (retry(entry.id()) != null) ok++;
        }
        return ok;
    }

    /**
     * Discard a failed route (after manual intervention).
     */
    @Transactional
    public boolean discard(long id) {
        FailedRoute entry = findById(id);
        if (entry == null) return false;
        pending.remove(entry);
        if (repository != null) repository.markResolved(id, Instant.now(), "DISCARDED");
        log.info("[ActionRouteDLQ] discarded id={} proposal={}", id, entry.proposalId());
        return true;
    }

    public List<FailedRoute> getPending() {
        if (repository != null) {
            try {
                return repository.findAll().stream()
                        .filter(e -> e.getResolvedAt() == null)
                        .map(e -> new FailedRoute(e.getId(), e.getRunId(), e.getProposalId(),
                                e.getActionCode(), e.getRiskLevel(), e.getReason(),
                                e.getFailedAt().toEpochMilli(), e.getRetryCount() == null ? 0 : e.getRetryCount()))
                        .collect(Collectors.toList());
            } catch (Exception e) {
                log.warn("[ActionRouteDLQ] DB read failed, falling back to in-memory: {}", e.getMessage());
            }
        }
        return List.copyOf(pending);
    }

    public int size() {
        return pending.size();
    }

    private FailedRoute findById(long id) {
        for (FailedRoute e : pending) if (e.id() == id) return e;
        return null;
    }

    /** Stub: in production, derive from TenantContext or Run. */
    private String extractTenant(String runId) {
        return com.metaplatform.agent.common.TenantContext.getTenantIdOrDefault();
    }
}
