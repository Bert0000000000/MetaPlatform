package com.metaplatform.agent.middleware;

import com.metaplatform.agent.action.ActionApprovalBridgeService;
import com.metaplatform.agent.action.ActionProposalService;
import com.metaplatform.ont.draft.OntologyDraftService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P5.9 ActionRouteDlqScheduler - scheduled retry of failed auto-routes.
 */
@DisplayName("P5.9 ActionRoute DLQ scheduler")
class ActionRouteDlqSchedulerTest {

    private ActionRouteDlqService dlqService;
    private ActionRouteDlqScheduler scheduler;

    @BeforeEach
    void setUp() {
        dlqService = Mockito.mock(ActionRouteDlqService.class);
        scheduler = new ActionRouteDlqScheduler(dlqService);
        ReflectionTestUtils.setField(scheduler, "enabled", true);
        ReflectionTestUtils.setField(scheduler, "maxRetries", 5);
    }

    @Test
    @DisplayName("retryPending: no-op when DLQ empty")
    void noOpWhenEmpty() {
        when(dlqService.getPending()).thenReturn(List.of());
        assertEquals(0, scheduler.retryPending());
        verify(dlqService, never()).retry(anyLong());
    }

    @Test
    @DisplayName("retryPending: skips entries with retry_count >= maxRetries")
    void skipsMaxRetries() {
        when(dlqService.getPending()).thenReturn(List.of(
                new ActionRouteDlqService.FailedRoute(1L, "run-1", "PROP-1", "RequestDiscount", "HIGH", "err", System.currentTimeMillis(), 5),
                new ActionRouteDlqService.FailedRoute(2L, "run-2", "PROP-2", "RequestDiscount", "HIGH", "err", System.currentTimeMillis(), 2)
        ));
        when(dlqService.retry(2L)).thenReturn("WFE-1");

        int ok = scheduler.retryPending();
        assertEquals(1, ok);
        verify(dlqService, never()).retry(1L);  // skipped
        verify(dlqService).retry(2L);
    }

    @Test
    @DisplayName("retryPending: returns count of SUCCESS retries")
    void countsSuccessRetries() {
        when(dlqService.getPending()).thenReturn(List.of(
                new ActionRouteDlqService.FailedRoute(1L, "run-1", "PROP-1", "A", "HIGH", "err", 0, 1),
                new ActionRouteDlqService.FailedRoute(2L, "run-2", "PROP-2", "B", "HIGH", "err", 0, 1),
                new ActionRouteDlqService.FailedRoute(3L, "run-3", "PROP-3", "C", "HIGH", "err", 0, 1)
        ));
        when(dlqService.retry(1L)).thenReturn("WFE-1");
        when(dlqService.retry(2L)).thenReturn(null);  // still failing
        when(dlqService.retry(3L)).thenReturn("WFE-3");

        int ok = scheduler.retryPending();
        assertEquals(2, ok);
    }

    @Test
    @DisplayName("retryPending: respects enabled flag")
    void respectsEnabledFlag() {
        ReflectionTestUtils.setField(scheduler, "enabled", false);
        assertEquals(0, scheduler.retryPending());
        verify(dlqService, never()).getPending();
    }

    @Test
    @DisplayName("retryPending: null dlqService safe (returns 0)")
    void nullDlqServiceSafe() {
        ActionRouteDlqScheduler bare = new ActionRouteDlqScheduler(null);
        ReflectionTestUtils.setField(bare, "enabled", true);
        assertEquals(0, bare.retryPending());
    }
}
