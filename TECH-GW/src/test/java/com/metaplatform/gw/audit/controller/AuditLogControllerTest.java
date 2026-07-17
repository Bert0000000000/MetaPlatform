package com.metaplatform.gw.audit.controller;

import com.metaplatform.gw.audit.dto.AuditLogResponse;
import com.metaplatform.gw.audit.dto.AuditLogStatistics;
import com.metaplatform.gw.audit.dto.RecordAuditLogRequest;
import com.metaplatform.gw.audit.service.AuditLogExportService;
import com.metaplatform.gw.audit.service.AuditLogService;
import com.metaplatform.gw.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@WebFluxTest(controllers = AuditLogController.class)
class AuditLogControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private AuditLogService auditLogService;

    @MockBean
    private AuditLogExportService exportService;

    private AuditLogResponse build() {
        return AuditLogResponse.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .path("/api/v1/test")
                .method("GET")
                .statusCode(200)
                .durationMs(120L)
                .build();
    }

    @Test
    void record_shouldReturn200() {
        when(auditLogService.record(any(RecordAuditLogRequest.class)))
                .thenReturn(Mono.just(build()));

        webTestClient.post()
                .uri("/api/v1/gw/audit-logs")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(RecordAuditLogRequest.builder().path("/x").method("GET").durationMs(1L).build())
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0);
    }

    @Test
    void query_shouldReturnPage() {
        PageResponse<AuditLogResponse> page = PageResponse.<AuditLogResponse>builder()
                .items(List.of(build()))
                .total(1).page(1).size(20).totalPages(1)
                .build();

        when(auditLogService.query(any(), any(), any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(Mono.just(page));

        webTestClient.get()
                .uri("/api/v1/gw/audit-logs")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.total").isEqualTo(1);
    }

    @Test
    void statistics_shouldReturnAggregated() {
        AuditLogStatistics stats = AuditLogStatistics.builder()
                .totalRequests(10L)
                .totalErrors(2L)
                .overallErrorRate(0.2)
                .build();
        when(auditLogService.getStatistics(any(), any(), any()))
                .thenReturn(Mono.just(stats));

        webTestClient.get()
                .uri("/api/v1/gw/audit-logs/statistics")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data.totalRequests").isEqualTo(10);
    }

    @Test
    void slowRequests_shouldReturnList() {
        when(auditLogService.findSlowRequests(anyLong(), any(), anyInt()))
                .thenReturn(Mono.just(List.of(build())));

        webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/gw/audit-logs/slow-requests")
                        .queryParam("threshold", 1000).build())
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0)
                .jsonPath("$.data").isArray();
    }

    @Test
    void byTrace_shouldReturnList() {
        when(auditLogService.findByTraceId(anyString()))
                .thenReturn(Mono.just(List.of(build())));

        webTestClient.get()
                .uri("/api/v1/gw/audit-logs/trace/trace-1")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.code").isEqualTo(0);
    }
}
