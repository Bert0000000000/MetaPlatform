package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * §17.10 fault drill: WFE is down, the system records entries into the DLQ;
 * WFE recovers; the scheduler retries; entries drain.
 *
 * <p>Uses only the public API (no new production code). Demonstrates the
 * "replay drill" that the spec calls out as currently missing automation.</p>
 *
 * <p>Stubbing note: ActionRouteDlqService.getPending() first consults the DB
 * via repository.findAll(); we mirror in-memory enqueues into findAll() so
 * the scheduler iterates the same list as the service.</p>
 */
@DisplayName("§17.10 WFE approval replay drill")
class WfeApprovalReplayDrillTest {

    private ActionProposalService proposalService;
    private ActionApprovalBridgeService approvalBridge;
    private ActionRouteDlqRepository repository;
    private ActionRouteDlqService service;
    private ActionRouteDlqScheduler scheduler;
    private final AtomicInteger wfeAttempts = new AtomicInteger(0);
    /** Mirror of in-memory enqueue() calls; injected into repository.findAll(). */
    private final List<ActionRouteDlqEntity> mirror = new ArrayList<>();

    @BeforeEach
    void setUp() {
        proposalService = Mockito.mock(ActionProposalService.class);
        approvalBridge = Mockito.mock(ActionApprovalBridgeService.class);
        repository = Mockito.mock(ActionRouteDlqRepository.class);
        mirror.clear();
        // findAll() returns whatever has been saved so the scheduler sees the same
        // entries the service has in its in-memory pending list.
        Mockito.when(repository.findAll()).thenAnswer(inv -> new ArrayList<>(mirror));
        Mockito.when(repository.save(Mockito.any(ActionRouteDlqEntity.class)))
                .thenAnswer(inv -> {
                    ActionRouteDlqEntity e = inv.getArgument(0);
                    if (e.getId() == null) e.setId((long) (mirror.size() + 1));
                    mirror.add(e);
                    return e;
                });
        Mockito.when(repository.incrementRetryCount(Mockito.any(Long.class), Mockito.any())).thenReturn(0);
        Mockito.when(repository.markResolved(Mockito.any(Long.class), Mockito.any(), Mockito.anyString())).thenReturn(0);

        service = new ActionRouteDlqService(proposalService, approvalBridge, null, repository, null);
        scheduler = new ActionRouteDlqScheduler(service);
        org.springframework.test.util.ReflectionTestUtils.setField(scheduler, "enabled", true);
        org.springframework.test.util.ReflectionTestUtils.setField(scheduler, "maxRetries", 3);
    }

    /** Configure the WFE bridge to fail the first failTimes calls, then succeed. */
    private void stubWfeFailsBeforeSuccess(int failTimes) {
        wfeAttempts.set(0);
        Mockito.when(approvalBridge.submitForApproval(
                        Mockito.anyString(), Mockito.nullable(String.class)))
                .thenAnswer(inv -> {
                    int attempt = wfeAttempts.getAndIncrement();
                    if (attempt < failTimes) {
                        throw new RuntimeException("WFE connection refused (drill attempt=" + attempt + ")");
                    }
                    return "WFE-DRILL-" + attempt;
                });
    }

    @Test
    @DisplayName("drill-1: WFE down -> enqueue -> retry fails -> re-enqueue after recover -> drain")
    void drillWfeDownThenRecover() {
        stubWfeFailsBeforeSuccess(1);
        service.enqueue("run-drill-1", "PROP-DRILL-1", "RequestDiscount", "HIGH", "WFE down");
        assertEquals(1, service.size());

        // Retry while WFE is still down -> returns null; in-memory entry stays,
        // DB row marked FAILED.
        String ok = service.retry(1L);
        assertNull(ok, "first retry should fail (WFE still down)");
        assertEquals(1, service.size(),
                "current production behaviour: failed retry leaves entry in pending so the scheduler retries again");

        // Operator manually re-enqueues once WFE recovers.
        service.enqueue("run-drill-1", "PROP-DRILL-1-REPLAY", "RequestDiscount", "HIGH", "second attempt");
        assertEquals(2, service.size());
        String ok2 = service.retry(2L);
        assertNotNull(ok2, "second retry should succeed once WFE recovers");
        assertTrue(ok2.startsWith("WFE-DRILL-"), "successful retry returns a WFE task id");
        assertEquals(1, service.size(), "successful retry drains only the matching entry");
    }

    @Test
    @DisplayName("drill-2: repository.markResolved called with FAILED on retry failure")
    void drillPersistenceFailurePath() {
        service.enqueue("run-drill-2", "PROP-DRILL-2", "ActionA", "LOW", "first attempt");
        Mockito.verify(repository, Mockito.times(1)).save(Mockito.any(ActionRouteDlqEntity.class));

        Mockito.when(approvalBridge.submitForApproval(Mockito.anyString(), Mockito.any()))
                .thenThrow(new RuntimeException("WFE down during retry"));
        assertNull(service.retry(1L));
        Mockito.verify(repository, Mockito.times(1))
                .markResolved(Mockito.eq(1L), Mockito.any(), Mockito.eq("FAILED"));
    }

    @Test
    @DisplayName("drill-3: scheduler drain counts match (1 fail + 1 success -> ok=1)")
    void drillSchedulerMixedOutcome() {
        service.enqueue("run-drill-3a", "PROP-DRILL-3a", "ActionA", "LOW", "first");
        service.enqueue("run-drill-3b", "PROP-DRILL-3b", "ActionB", "LOW", "first");
        // Synchronize mirror with in-memory: service.enqueue also calls repository.save
        // (which our stub records into mirror), so mirror already has 2 entries.
        // Force repository.findAll() to expose them ordered by id ascending for the scheduler.
        Mockito.when(repository.findAll()).thenAnswer(inv -> {
            List<ActionRouteDlqEntity> snapshot = new ArrayList<>(mirror);
            snapshot.sort((a, b) -> Long.compare(a.getId(), b.getId()));
            return snapshot;
        });

        wfeAttempts.set(0);
        Mockito.when(approvalBridge.submitForApproval(
                        Mockito.anyString(), Mockito.nullable(String.class)))
                .thenAnswer(inv -> {
                    int attempt = wfeAttempts.getAndIncrement();
                    if (attempt == 0) throw new RuntimeException("drill: still down");
                    return "WFE-DRILL-3-" + attempt;
                });
        int ok = scheduler.retryPending();
        assertEquals(1, ok, "exactly one entry drained successfully");
    }
}
