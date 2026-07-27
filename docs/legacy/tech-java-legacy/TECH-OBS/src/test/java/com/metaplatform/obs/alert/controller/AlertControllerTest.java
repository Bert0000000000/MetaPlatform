package com.metaplatform.obs.alert.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.metaplatform.obs.alert.dto.AlertStatistics;
import com.metaplatform.obs.alert.dto.SilenceRequest;
import com.metaplatform.obs.alert.entity.AlertEntity;
import com.metaplatform.obs.alert.entity.AlertRuleEntity;
import com.metaplatform.obs.alert.entity.AlertSilenceEntity;
import com.metaplatform.obs.alert.entity.NotificationChannelEntity;
import com.metaplatform.obs.alert.service.AlertService;
import com.metaplatform.obs.common.TraceFilter;
import com.metaplatform.obs.exception.GlobalExceptionHandler;
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
import java.util.Map;
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

@WebMvcTest(controllers = {AlertRuleController.class, AlertController.class, NotificationChannelController.class},
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class AlertControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AlertService alertService;

    @Test
    void createRule_shouldReturnCreatedRule() throws Exception {
        AlertRuleEntity saved = AlertRuleEntity.builder()
                .id(UUID.randomUUID())
                .metricName("cpu_usage")
                .conditionOperator("GT")
                .threshold(80.0)
                .severity("WARNING")
                .enabled(true)
                .build();
        when(alertService.createRule(any())).thenReturn(saved);

        String body = """
                {"name":"CPU","metricName":"cpu_usage","conditionOperator":"GT",
                 "threshold":80.0,"durationSeconds":60,"severity":"WARNING","enabled":true}
                """;

        mockMvc.perform(post("/api/v1/obs/alert-rules")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.metricName").value("cpu_usage"))
                .andExpect(jsonPath("$.data.severity").value("WARNING"));
    }

    @Test
    void listAlerts_shouldReturnFiringAlerts() throws Exception {
        AlertEntity alert = AlertEntity.builder()
                .id(UUID.randomUUID()).ruleId(UUID.randomUUID())
                .value(95.0).status("FIRING").triggeredAt(Instant.now()).build();
        when(alertService.listAlerts(eq("firing"))).thenReturn(List.of(alert));

        mockMvc.perform(get("/api/v1/obs/alerts?status=firing"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("FIRING"))
                .andExpect(jsonPath("$.data[0].value").value(95.0));
    }

    @Test
    void silenceAlert_shouldReturnSilenceRecord() throws Exception {
        UUID alertId = UUID.randomUUID();
        AlertSilenceEntity silence = AlertSilenceEntity.builder()
                .id(UUID.randomUUID())
                .alertId(alertId)
                .silencedUntil(Instant.now().plusSeconds(3600))
                .reason("维护中")
                .build();
        when(alertService.silenceAlert(eq(alertId), any(SilenceRequest.class))).thenReturn(silence);

        String body = objectMapper.writeValueAsString(SilenceRequest.builder()
                .durationSeconds(3600).reason("维护中").createdBy("admin").build());

        mockMvc.perform(post("/api/v1/obs/alerts/" + alertId + "/silence")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reason").value("维护中"));
    }

    @Test
    void getStatistics_shouldReturnStats() throws Exception {
        when(alertService.getStatistics()).thenReturn(AlertStatistics.builder()
                .active(5).firing(3).silenced(2).recoveredToday(7)
                .bySeverity(Map.of("WARNING", 4L, "CRITICAL", 1L))
                .build());

        mockMvc.perform(get("/api/v1/obs/alerts/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(5))
                .andExpect(jsonPath("$.data.firing").value(3))
                .andExpect(jsonPath("$.data.bySeverity.WARNING").value(4));
    }

    @Test
    void createChannel_shouldReturnChannel() throws Exception {
        NotificationChannelEntity channel = NotificationChannelEntity.builder()
                .id(UUID.randomUUID()).name("ops-feishu").type("feishu")
                .enabled(true)
                .config(JsonNodeFactory.instance.objectNode())
                .build();
        when(alertService.createChannel(any())).thenReturn(channel);

        String body = """
                {"name":"ops-feishu","type":"feishu","enabled":true}
                """;

        mockMvc.perform(post("/api/v1/obs/notification-channels")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("ops-feishu"))
                .andExpect(jsonPath("$.data.type").value("feishu"));
    }

    @Test
    void deleteRule_shouldReturnSuccess() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/obs/alert-rules/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void putRule_shouldUpdateAndReturn() throws Exception {
        UUID id = UUID.randomUUID();
        AlertRuleEntity updated = AlertRuleEntity.builder()
                .id(id).metricName("cpu_usage").conditionOperator("GT")
                .threshold(90.0).severity("CRITICAL").enabled(true).build();
        when(alertService.updateRule(eq(id), any())).thenReturn(updated);

        String body = """
                {"name":"CPU","metricName":"cpu_usage","conditionOperator":"GT",
                 "threshold":90.0,"durationSeconds":60,"severity":"CRITICAL","enabled":true}
                """;

        mockMvc.perform(put("/api/v1/obs/alert-rules/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.threshold").value(90.0))
                .andExpect(jsonPath("$.data.severity").value("CRITICAL"));
    }
}