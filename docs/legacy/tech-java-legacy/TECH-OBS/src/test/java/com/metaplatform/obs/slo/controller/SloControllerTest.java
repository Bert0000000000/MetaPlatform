package com.metaplatform.obs.slo.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.common.TraceFilter;
import com.metaplatform.obs.exception.GlobalExceptionHandler;
import com.metaplatform.obs.slo.dto.ErrorBudget;
import com.metaplatform.obs.slo.dto.SloReport;
import com.metaplatform.obs.slo.entity.SloEntity;
import com.metaplatform.obs.slo.service.SloService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SloController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class SloControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SloService sloService;

    @Test
    void create_shouldReturnSlo() throws Exception {
        SloEntity entity = SloEntity.builder()
                .id(UUID.randomUUID())
                .name("API 可用性")
                .serviceName("tech-iam")
                .sliType("AVAILABILITY")
                .sliQuery("up{job=\"tech-iam\"}")
                .target(99.9)
                .window("30d")
                .errorBudgetTotal(0.1)
                .build();
        when(sloService.create(any())).thenReturn(entity);

        String body = """
                {"name":"API 可用性","serviceName":"tech-iam","sliType":"AVAILABILITY",
                 "sliQuery":"up{job=\\"tech-iam\\"}","target":99.9,"window":"30d"}
                """;

        mockMvc.perform(post("/api/v1/obs/slos")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.name").value("API 可用性"))
                .andExpect(jsonPath("$.data.target").value(99.9));
    }

    @Test
    void list_shouldReturnSlos() throws Exception {
        when(sloService.list()).thenReturn(List.of(
                SloEntity.builder().id(UUID.randomUUID()).name("A").build(),
                SloEntity.builder().id(UUID.randomUUID()).name("B").build()));

        mockMvc.perform(get("/api/v1/obs/slos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void getErrorBudget_shouldReturnBudget() throws Exception {
        UUID id = UUID.randomUUID();
        when(sloService.getErrorBudget(eq(id))).thenReturn(ErrorBudget.builder()
                .target(99.9).totalBudget(0.1).consumedBudget(0.05)
                .remainingBudget(0.05).burnRate(0.001).status("HEALTHY").window("30d").build());

        mockMvc.perform(get("/api/v1/obs/slos/" + id + "/error-budget"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.target").value(99.9))
                .andExpect(jsonPath("$.data.totalBudget").value(0.1))
                .andExpect(jsonPath("$.data.remainingBudget").value(0.05));
    }

    @Test
    void getReport_shouldReturnReport() throws Exception {
        UUID id = UUID.randomUUID();
        when(sloService.generateReport(eq(id), eq("7d"))).thenReturn(SloReport.builder()
                .sloId(id.toString())
                .name("API 可用性")
                .serviceName("tech-iam")
                .period("7d")
                .target(99.9)
                .actualAvailability(99.5)
                .errorBudget(ErrorBudget.builder().totalBudget(0.1).consumedBudget(0.05).build())
                .status("AT_RISK")
                .generatedAt(Instant.now())
                .build());

        mockMvc.perform(get("/api/v1/obs/slos/" + id + "/report?period=7d"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.period").value("7d"))
                .andExpect(jsonPath("$.data.actualAvailability").value(99.5))
                .andExpect(jsonPath("$.data.status").value("AT_RISK"));
    }

    @Test
    void update_shouldReturnUpdatedSlo() throws Exception {
        UUID id = UUID.randomUUID();
        SloEntity updated = SloEntity.builder().id(id)
                .name("更新后").serviceName("tech-iam").sliType("AVAILABILITY").sliQuery("up")
                .target(99.5).window("30d").errorBudgetTotal(0.5).build();
        when(sloService.update(eq(id), any())).thenReturn(updated);

        String body = """
                {"name":"更新后","serviceName":"tech-iam","sliType":"AVAILABILITY",
                 "sliQuery":"up","target":99.5,"window":"30d"}
                """;

        mockMvc.perform(put("/api/v1/obs/slos/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.target").value(99.5));
    }

    @Test
    void delete_shouldReturnSuccess() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/obs/slos/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }
}