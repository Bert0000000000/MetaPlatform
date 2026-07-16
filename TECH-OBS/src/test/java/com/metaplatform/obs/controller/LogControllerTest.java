package com.metaplatform.obs.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.obs.dto.LogEntry;
import com.metaplatform.obs.dto.LogIngestRequest;
import com.metaplatform.obs.dto.LogQueryRequest;
import com.metaplatform.obs.dto.PageResponse;
import com.metaplatform.obs.exception.GlobalExceptionHandler;
import com.metaplatform.obs.exception.ObsException;
import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.service.LogIngestService;
import com.metaplatform.obs.service.LokiQueryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = LogController.class)
@Import(GlobalExceptionHandler.class)
class LogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private LokiQueryService lokiQueryService;

    @MockBean
    private LogIngestService logIngestService;

    @Test
    void query_shouldReturnSuccessWithPageResponse() throws Exception {
        LogEntry entry = LogEntry.builder()
                .timestamp(Instant.parse("2026-07-16T00:00:00Z"))
                .serviceName("iam")
                .level("ERROR")
                .traceId("trace-1")
                .message("login failed")
                .build();
        PageResponse<LogEntry> page = PageResponse.<LogEntry>builder()
                .items(List.of(entry))
                .total(1)
                .page(1)
                .pageSize(10)
                .totalPages(1)
                .build();
        when(lokiQueryService.query(any(LogQueryRequest.class))).thenReturn(page);

        LogQueryRequest req = new LogQueryRequest();
        req.setServiceName("iam");
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));
        req.setPage(1);
        req.setSize(10);

        mockMvc.perform(post("/api/v1/obs/logs/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].serviceName").value("iam"))
                .andExpect(jsonPath("$.data.items[0].message").value("login failed"))
                .andExpect(jsonPath("$.traceId").exists());
    }

    @Test
    void query_shouldReturn400WhenStartTimeMissing() throws Exception {
        LogQueryRequest req = new LogQueryRequest();
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        mockMvc.perform(post("/api/v1/obs/logs/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_PARAM.getCode()));
    }

    @Test
    void query_shouldReturn400WhenPageLessThanOne() throws Exception {
        LogQueryRequest req = new LogQueryRequest();
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));
        req.setPage(0);

        mockMvc.perform(post("/api/v1/obs/logs/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_PARAM.getCode()));
    }

    @Test
    void query_shouldPropagateLokiUnavailableAs503() throws Exception {
        when(lokiQueryService.query(any(LogQueryRequest.class)))
                .thenThrow(new ObsException(ErrorCode.LOKI_UNAVAILABLE, "Loki 不可用"));

        LogQueryRequest req = new LogQueryRequest();
        req.setStartTime(OffsetDateTime.of(2026, 7, 16, 0, 0, 0, 0, ZoneOffset.UTC));
        req.setEndTime(OffsetDateTime.of(2026, 7, 16, 1, 0, 0, 0, ZoneOffset.UTC));

        mockMvc.perform(post("/api/v1/obs/logs/query")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value(ErrorCode.LOKI_UNAVAILABLE.getCode()))
                .andExpect(jsonPath("$.message").value("Loki 不可用"));
    }

    @Test
    void ingest_shouldReturnSuccessWithLogId() throws Exception {
        when(logIngestService.ingest(any(LogIngestRequest.class))).thenReturn("log-id-abc");

        ObjectNode root = JsonNodeFactory.instance.objectNode();
        root.put("serviceName", "iam");
        root.put("level", "INFO");
        root.put("traceId", "trace-1");
        root.put("message", "user login success");
        ObjectNode labels = JsonNodeFactory.instance.objectNode();
        labels.put("env", "dev");
        root.set("labels", labels);

        mockMvc.perform(post("/api/v1/obs/logs/ingest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(root)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").value("log-id-abc"))
                .andExpect(jsonPath("$.traceId").exists());
    }

    @Test
    void ingest_shouldReturn400WhenServiceNameBlank() throws Exception {
        ObjectNode root = JsonNodeFactory.instance.objectNode();
        root.put("serviceName", "");
        root.put("level", "INFO");
        root.put("message", "msg");

        mockMvc.perform(post("/api/v1/obs/logs/ingest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(root)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_PARAM.getCode()));
    }

    @Test
    void ingest_shouldReturn400WhenLevelBlank() throws Exception {
        ObjectNode root = JsonNodeFactory.instance.objectNode();
        root.put("serviceName", "iam");
        root.put("level", "");
        root.put("message", "msg");

        mockMvc.perform(post("/api/v1/obs/logs/ingest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(root)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_PARAM.getCode()));
    }

    @Test
    void ingest_shouldReturn400WhenMessageMissing() throws Exception {
        ObjectNode root = JsonNodeFactory.instance.objectNode();
        root.put("serviceName", "iam");
        root.put("level", "INFO");

        mockMvc.perform(post("/api/v1/obs/logs/ingest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(root)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.INVALID_PARAM.getCode()));
    }
}