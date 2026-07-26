package com.metaplatform.agent.authoring;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P6-AUTH-06 AuthoringBatchFlushScheduler - thin scheduled job that calls
 * {@link AuthoringBatchAccumulator#flushDue}. Verifies:
 * <ol>
 *   <li>With no buffer or no AuthoringService, no-op (returns 0).</li>
 *   <li>When the buffer has aged entries, flush is called and returned
 *       value is forwarded.</li>
 * </ol>
 */
@DisplayName("P6-AUTH-06 AuthoringBatchFlushScheduler")
class AuthoringBatchFlushSchedulerTest {

    private AuthoringBatchAccumulator accumulator;
    private AuthoringService authoringService;
    private AuthoringBatchFlushScheduler scheduler;

    @BeforeEach
    void setUp() {
        accumulator = Mockito.mock(AuthoringBatchAccumulator.class);
        authoringService = Mockito.mock(AuthoringService.class);
        scheduler = new AuthoringBatchFlushScheduler(accumulator, authoringService);
        ReflectionTestUtils.setField(scheduler, "maxAgeMillis", 1000L);
    }

    @Test
    @DisplayName("happy path: forwards flush count")
    void forwardsFlushCount() {
        Mockito.when(accumulator.size()).thenReturn(5);
        Mockito.when(accumulator.flushDue(authoringService, 1000L)).thenReturn(2);
        int result = scheduler.flushPending();
        assertEquals(2, result);
        Mockito.verify(accumulator).flushDue(authoringService, 1000L);
    }

    @Test
    @DisplayName("empty buffer: returns 0, no submit")
    void emptyBuffer() {
        Mockito.when(accumulator.size()).thenReturn(0);
        assertEquals(0, scheduler.flushPending());
        Mockito.verify(accumulator, Mockito.never()).flushDue(Mockito.any(), Mockito.anyLong());
    }

    @Test
    @DisplayName("null accumulator or service: returns 0 (no NPE)")
    void nullDepsNoop() {
        AuthoringBatchFlushScheduler s1 = new AuthoringBatchFlushScheduler(null, authoringService);
        AuthoringBatchFlushScheduler s2 = new AuthoringBatchFlushScheduler(accumulator, null);
        assertEquals(0, s1.flushPending());
        assertEquals(0, s2.flushPending());
    }
}
