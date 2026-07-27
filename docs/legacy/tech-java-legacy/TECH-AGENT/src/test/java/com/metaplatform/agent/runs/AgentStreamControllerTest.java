package com.metaplatform.agent.runs;

import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.agent.events.dto.RunEventDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AgentStreamControllerTest {
    private final RunEventService service = Mockito.mock(RunEventService.class);
    private final AgentStreamController controller = new AgentStreamController(service);

    @AfterEach
    void clearTenant() { TenantContext.clear(); }

    @Test
    void streamEmitsNamedSseFramesFromExclusiveReplayPage() {
        TenantContext.setTenantId("tenant-a");
        RunEventDto event = RunEventDto.builder().eventId("EVT-3").runId("RUN-1")
                .tenantId("tenant-a").type("CLAIM_PRODUCED").seq(3L).payload(Map.of("claimId", "C-1")).build();
        Mockito.when(service.listForTenant("tenant-a", "RUN-1", 2L)).thenReturn(List.of(event));

        var frames = controller.stream("RUN-1", 2L).collectList().block();
        assertEquals(1, frames.size());
        var frame = frames.get(0);
        assertEquals("EVT-3", frame.id());
        assertEquals("CLAIM_PRODUCED", frame.event());
        assertEquals(event, frame.data());
        Mockito.verify(service).listForTenant("tenant-a", "RUN-1", 2L);
    }
}
