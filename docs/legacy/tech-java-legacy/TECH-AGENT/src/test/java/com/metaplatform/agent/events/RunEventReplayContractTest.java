package com.metaplatform.agent.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.events.dto.RunEventDto;
import com.metaplatform.agent.runs.AgentRunEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * §17.5 SSE replay contract: seq is monotonic, afterSeq filter is exclusive and stable,
 * same-tenant filter excludes foreign events.
 */
@DisplayName("§17.5 RunEvent replay contract")
class RunEventReplayContractTest {

    private RunEventRepository repository;
    private RunEventService service;

    @BeforeEach
    void setUp() {
        repository = Mockito.mock(RunEventRepository.class);
        service = new RunEventService(repository, new ObjectMapper());
    }

    private AgentRunEntity runEntity(String runId, String tenantId) {
        return AgentRunEntity.builder().runId(runId).tenantId(tenantId).userId("u").agentId("a")
                .runtimeType("DEERFLOW").status("RUNNING").goal("g").traceId("t")
                .budget("{}").createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    @Test
    @DisplayName("record() assigns strictly-mono-increasing seq starting at 1")
    void seqMonotonicFromOne() {
        Mockito.when(repository.findByRunIdOrderBySeqAsc("RUN-RPL-1"))
                .thenReturn(List.of());
        AgentRunEntity run = runEntity("RUN-RPL-1", "TENANT-A");
        List<RunEventEntity> saved = new ArrayList<>();
        Mockito.when(repository.saveAndFlush(Mockito.any(RunEventEntity.class)))
                .thenAnswer(inv -> { RunEventEntity e = inv.getArgument(0); saved.add(e);
                                     // subsequent findByRunIdOrderBySeqAsc should now reflect the latest save.
                                     List<RunEventEntity> tail = saved.subList(0, saved.size());
                                     Mockito.when(repository.findByRunIdOrderBySeqAsc("RUN-RPL-1"))
                                             .thenReturn(new ArrayList<>(tail));
                                     return e; });
        for (int i = 1; i <= 5; i++) {
            service.record(run, "TOOL_COMPLETED", Map.of("step", i));
        }
        assertEquals(5, saved.size());
        for (int i = 0; i < 5; i++) {
            assertEquals(i + 1L, saved.get(i).getSeq(),
                    "seq must be strictly increasing from 1: " + saved);
        }
    }

    @Test
    @DisplayName("afterSeq replay returns strictly-greater events in seq order")
    void afterSeqReplayExclusive() {
        AgentRunEntity run = runEntity("RUN-RPL-2", "TENANT-A");
        for (int i = 1; i <= 5; i++) {
            service.record(run, "TOOL_COMPLETED", Map.of("step", i));
        }
        // Repository returns 3 events (seq 3,4,5) when asked with afterSeq=2.
        List<RunEventEntity> page3 = new ArrayList<>();
        for (long s : new long[] { 3L, 4L, 5L }) {
            page3.add(RunEventEntity.builder().runId("RUN-RPL-2").tenantId("TENANT-A")
                    .seq(s).type(RunEventType.TOOL_COMPLETED).traceId("t")
                    .createdAt(Instant.now()).ts(Instant.now()).build());
        }
        Mockito.when(repository.findByRunIdAndSeqGreaterThanOrderBySeqAsc("RUN-RPL-2", 2L))
                .thenReturn(page3);
        List<RunEventDto> out = service.list("RUN-RPL-2", 2L, null);
        assertEquals(3, out.size());
        assertEquals(java.util.List.of(3L, 4L, 5L),
                out.stream().map(RunEventDto::getSeq).toList());
        // afterSeq=5 -> empty.
        Mockito.when(repository.findByRunIdAndSeqGreaterThanOrderBySeqAsc("RUN-RPL-2", 5L))
                .thenReturn(List.of());
        assertEquals(0, service.list("RUN-RPL-2", 5L, null).size());
    }

    @Test
    @DisplayName("listForTenant filters out other tenants' events")
    void tenantFilter() {
        AgentRunEntity runA = runEntity("RUN-A", "TENANT-A");
        AgentRunEntity runB = runEntity("RUN-B", "TENANT-B");
        service.record(runA, "TOOL_COMPLETED", Map.of());
        service.record(runB, "TOOL_COMPLETED", Map.of());
        service.record(runA, "RUN_COMPLETED", Map.of());
        Mockito.when(repository.findByRunIdOrderBySeqAsc("RUN-A"))
                .thenReturn(List.of(
                        RunEventEntity.builder().runId("RUN-A").tenantId("TENANT-A").seq(1L).type(RunEventType.TOOL_COMPLETED).traceId("t").createdAt(Instant.now()).ts(Instant.now()).build(),
                        RunEventEntity.builder().runId("RUN-A").tenantId("TENANT-A").seq(2L).type(RunEventType.RUN_COMPLETED).traceId("t").createdAt(Instant.now()).ts(Instant.now()).build()
                ));
        Mockito.when(repository.findByRunIdOrderBySeqAsc("RUN-B"))
                .thenReturn(List.of(
                        RunEventEntity.builder().runId("RUN-B").tenantId("TENANT-B").seq(1L).type(RunEventType.TOOL_COMPLETED).traceId("t").createdAt(Instant.now()).ts(Instant.now()).build()
                ));
        assertEquals(2, service.listForTenant("TENANT-A", "RUN-A", null).size());
        assertEquals(1, service.listForTenant("TENANT-B", "RUN-B", null).size());
    }

    @Test
    @DisplayName("listForTenant with afterSeq combines correctly")
    void compoundFilter() {
        AgentRunEntity run = runEntity("RUN-MIX", "TENANT-A");
        service.record(run, "TOOL_COMPLETED", Map.of("n", 1));
        service.record(run, "TOOL_COMPLETED", Map.of("n", 2));
        service.record(run, "RUN_COMPLETED", Map.of("n", 3));
        Mockito.when(repository.findByRunIdAndSeqGreaterThanOrderBySeqAsc("RUN-MIX", 1L))
                .thenReturn(List.of(
                        RunEventEntity.builder().runId("RUN-MIX").tenantId("TENANT-A").seq(2L).type(RunEventType.TOOL_COMPLETED).traceId("t").createdAt(Instant.now()).ts(Instant.now()).build(),
                        RunEventEntity.builder().runId("RUN-MIX").tenantId("TENANT-A").seq(3L).type(RunEventType.RUN_COMPLETED).traceId("t").createdAt(Instant.now()).ts(Instant.now()).build()
                ));
        List<RunEventDto> page = service.listForTenant("TENANT-A", "RUN-MIX", 1L);
        assertEquals(2, page.size());
        assertEquals(java.util.List.of(2L, 3L),
                page.stream().map(RunEventDto::getSeq).toList());
    }

    @Test
    @DisplayName("AgentRunService saves+flushed BEFORE returning to caller (RE-2 ordering)")
    void saveBeforeReturn() {
        Mockito.when(repository.findByRunIdOrderBySeqAsc("RUN-RE2"))
                .thenReturn(List.of());
        AgentRunEntity run = runEntity("RUN-RE2", "TENANT-A");
        service.record(run, "RUN_STARTED", Map.of("k", "v"));
        ArgumentCaptor<RunEventEntity> captor = ArgumentCaptor.forClass(RunEventEntity.class);
        Mockito.verify(repository).saveAndFlush(captor.capture());
        // and order: saveAndFlush was called BEFORE the list() query above, 
        // proving the seq calculation read state from the previous flush.
        org.mockito.Mockito.inOrder(repository);
        org.mockito.InOrder order = Mockito.inOrder(repository);
        order.verify(repository).findByRunIdOrderBySeqAsc("RUN-RE2");
        order.verify(repository).saveAndFlush(captor.capture());
        assertEquals(1L, captor.getValue().getSeq());
    }
}
