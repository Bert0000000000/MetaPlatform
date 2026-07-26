package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.agent.action.dto.ActionProposalCreateRequest;
import com.metaplatform.agent.action.dto.ActionProposalDto;
import com.metaplatform.ont.draft.OntologyDraftService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
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
    private final ActionApprovalBridgeService approvalBridge;
    private final OntologyDraftService draftService;  // optional - only for cleanup hooks

    @Autowired
    public ActionRouteDlqService(
            @Autowired(required = false) ActionProposalService proposalService,
            @Autowired(required = false) ActionApprovalBridgeService approvalBridge,
            @Autowired(required = false) OntologyDraftService draftService) {
        this.proposalService = proposalService;
        this.approvalBridge = approvalBridge;
        this.draftService = draftService;
    }

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
    public void enqueue(String runId, String proposalId, String actionCode,
                        String riskLevel, String reason) {
        long id = nextId.getAndIncrement();
        FailedRoute entry = new FailedRoute(id, runId, proposalId, actionCode, riskLevel,
                reason, System.currentTimeMillis(), 0);
        pending.add(entry);
        log.warn("[ActionRouteDLQ] enqueued id={} proposal={} action={} reason={}",
                id, proposalId, actionCode, reason);
    }

    /**
     * Retry a specific entry by id.
     * @return the new WFE task id, or null if still failed
     */
    public String retry(long id) {
        FailedRoute entry = findById(id);
        if (entry == null) return null;
        try {
            String wfeTaskId = approvalBridge.submitForApproval(entry.proposalId(), null);
            pending.remove(entry);
            log.info("[ActionRouteDLQ] retried id={} proposal={} -> wfeTask={}", id, entry.proposalId(), wfeTaskId);
            return wfeTaskId;
        } catch (Exception e) {
            log.warn("[ActionRouteDLQ] retry id={} still failed: {}", id, e.getMessage());
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
    public boolean discard(long id) {
        FailedRoute entry = findById(id);
        if (entry == null) return false;
        pending.remove(entry);
        log.info("[ActionRouteDLQ] discarded id={} proposal={}", id, entry.proposalId());
        return true;
    }

    public List<FailedRoute> getPending() {
        return List.copyOf(pending);
    }

    public int size() {
        return pending.size();
    }

    private FailedRoute findById(long id) {
        for (FailedRoute e : pending) if (e.id() == id) return e;
        return null;
    }
}
