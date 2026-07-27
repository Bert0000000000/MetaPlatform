package com.metaplatform.obs.anomaly.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.anomaly.dto.AnomalyEventResponse;
import com.metaplatform.obs.anomaly.dto.AnomalyRuleRequest;
import com.metaplatform.obs.anomaly.dto.RemediationResult;
import com.metaplatform.obs.anomaly.dto.RootCauseAnalysisResult;
import com.metaplatform.obs.anomaly.entity.AnomalyDetectionRuleEntity;
import com.metaplatform.obs.anomaly.service.AnomalyService;
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

@WebMvcTest(controllers = AnomalyController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class AnomalyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AnomalyService anomalyService;

    @Test
    void listAnomalies_shouldReturnEvents() throws Exception {
        AnomalyEventResponse event = AnomalyEventResponse.builder()
                .id(UUID.randomUUID())
                .anomalyType("ERROR_RATE")
                .severity("CRITICAL")
                .serviceName("tech-obs")
                .status("OPEN")
                .metricValue(12.5)
                .detectedAt(Instant.now())
                .build();
        when(anomalyService.listEvents(eq("OPEN"))).thenReturn(List.of(event));

        mockMvc.perform(get("/api/v1/obs/anomalies?status=OPEN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].serviceName").value("tech-obs"))
                .andExpect(jsonPath("$.data[0].severity").value("CRITICAL"));
    }

    @Test
    void getAnomaly_shouldReturnEventDetail() throws Exception {
        UUID id = UUID.randomUUID();
        AnomalyEventResponse event = AnomalyEventResponse.builder()
                .id(id)
                .anomalyType("P99_LATENCY")
                .serviceName("tech-action")
                .status("OPEN")
                .metricValue(1250.0)
                .build();
        when(anomalyService.getEvent(id)).thenReturn(event);

        mockMvc.perform(get("/api/v1/obs/anomalies/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.anomalyType").value("P99_LATENCY"))
                .andExpect(jsonPath("$.data.metricValue").value(1250.0));
    }

    @Test
    void analyzeAnomaly_shouldReturnRootCause() throws Exception {
        UUID id = UUID.randomUUID();
        RootCauseAnalysisResult result = RootCauseAnalysisResult.builder()
                .conclusion("服务 tech-obs 错误率异常")
                .suggestedAction("serviceRestart")
                .relatedMetrics(Map.of("currentValue", 12.5))
                .build();
        when(anomalyService.analyze(id)).thenReturn(result);

        mockMvc.perform(post("/api/v1/obs/anomalies/" + id + "/analyze"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.conclusion").value("服务 tech-obs 错误率异常"))
                .andExpect(jsonPath("$.data.suggestedAction").value("serviceRestart"));
    }

    @Test
    void remediateAnomaly_shouldReturnAdviseResult() throws Exception {
        UUID id = UUID.randomUUID();
        RemediationResult result = RemediationResult.builder()
                .executed(false)
                .actionCode("cacheClear")
                .actionName("清理缓存")
                .message("建议执行清理缓存")
                .build();
        when(anomalyService.remediate(eq(id), any())).thenReturn(result);

        mockMvc.perform(post("/api/v1/obs/anomalies/" + id + "/remediate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"ADVISE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executed").value(false))
                .andExpect(jsonPath("$.data.actionCode").value("cacheClear"));
    }

    @Test
    void listRules_shouldReturnRules() throws Exception {
        AnomalyDetectionRuleEntity rule = AnomalyDetectionRuleEntity.builder()
                .id(UUID.randomUUID())
                .name("高错误率")
                .metricType("ERROR_RATE")
                .conditionOperator("GT")
                .threshold(5.0)
                .aggregationFunction("AVG")
                .severity("WARNING")
                .enabled(true)
                .build();
        when(anomalyService.listRules()).thenReturn(List.of(rule));

        mockMvc.perform(get("/api/v1/obs/anomaly-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].metricType").value("ERROR_RATE"))
                .andExpect(jsonPath("$.data[0].threshold").value(5.0));
    }

    @Test
    void createRule_shouldReturnCreatedRule() throws Exception {
        AnomalyDetectionRuleEntity saved = AnomalyDetectionRuleEntity.builder()
                .id(UUID.randomUUID())
                .name("P99 延迟")
                .metricType("P99_LATENCY")
                .conditionOperator("GT")
                .threshold(1000.0)
                .aggregationFunction("AVG")
                .severity("CRITICAL")
                .enabled(true)
                .build();
        when(anomalyService.createRule(any(AnomalyRuleRequest.class))).thenReturn(saved);

        String body = objectMapper.writeValueAsString(AnomalyRuleRequest.builder()
                .name("P99 延迟")
                .metricType("P99_LATENCY")
                .conditionOperator("GT")
                .threshold(1000.0)
                .aggregationFunction("AVG")
                .severity("CRITICAL")
                .enabled(true)
                .build());

        mockMvc.perform(post("/api/v1/obs/anomaly-rules")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricType").value("P99_LATENCY"))
                .andExpect(jsonPath("$.data.severity").value("CRITICAL"));
    }

    @Test
    void createRule_shouldReturn400_whenMissingRequiredField() throws Exception {
        String body = "{\"name\":\"test\",\"metricType\":\"ERROR_RATE\"}";

        mockMvc.perform(post("/api/v1/obs/anomaly-rules")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void updateRule_shouldReturnUpdatedRule() throws Exception {
        UUID id = UUID.randomUUID();
        AnomalyDetectionRuleEntity updated = AnomalyDetectionRuleEntity.builder()
                .id(id)
                .name("更新后")
                .metricType("ERROR_RATE")
                .conditionOperator("GT")
                .threshold(3.0)
                .aggregationFunction("AVG")
                .severity("WARNING")
                .enabled(false)
                .build();
        when(anomalyService.updateRule(eq(id), any(AnomalyRuleRequest.class))).thenReturn(updated);

        String body = objectMapper.writeValueAsString(AnomalyRuleRequest.builder()
                .name("更新后")
                .metricType("ERROR_RATE")
                .conditionOperator("GT")
                .threshold(3.0)
                .aggregationFunction("AVG")
                .severity("WARNING")
                .enabled(false)
                .build());

        mockMvc.perform(put("/api/v1/obs/anomaly-rules/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));
    }

    @Test
    void deleteRule_shouldReturnSuccess() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/obs/anomaly-rules/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }
}
