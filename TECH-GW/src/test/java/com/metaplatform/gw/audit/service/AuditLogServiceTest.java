package com.metaplatform.gw.audit.service;

import com.metaplatform.gw.audit.dto.RecordAuditLogRequest;
import com.metaplatform.gw.audit.entity.GwAuditLogEntity;
import com.metaplatform.gw.audit.repository.GwAuditLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.test.StepVerifier;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock
    private GwAuditLogRepository repository;

    @InjectMocks
    private AuditLogService service;

    @Test
    void record_persistsEntity() {
        when(repository.save(any(GwAuditLogEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        RecordAuditLogRequest request = RecordAuditLogRequest.builder()
                .tenantId("tenant-default")
                .path("/api/v1/test")
                .method("GET")
                .statusCode(200)
                .durationMs(120L)
                .userId("user-1")
                .traceId("trace-1")
                .build();

        StepVerifier.create(service.record(request))
                .assertNext(response -> {
                    assertThat(response.getPath()).isEqualTo("/api/v1/test");
                    assertThat(response.getUserId()).isEqualTo("user-1");
                    assertThat(response.getId()).isNotNull();
                })
                .verifyComplete();

        verify(repository, times(1)).save(any(GwAuditLogEntity.class));
    }

    @Test
    void query_returnsPagedResults() {
        GwAuditLogEntity entity = sample();
        org.springframework.data.domain.Page<GwAuditLogEntity> page =
                new org.springframework.data.domain.PageImpl<>(List.of(entity));
        when(repository.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(page);

        StepVerifier.create(service.query(null, "/api/v1/foo", "GET", null, null, null, null, 1, 20))
                .assertNext(paged -> {
                    assertThat(paged.getItems()).hasSize(1);
                    assertThat(paged.getTotal()).isEqualTo(1L);
                })
                .verifyComplete();
    }

    @Test
    void findSlowRequests_filtersByThreshold() {
        GwAuditLogEntity entity = sample();
        when(repository.findSlowRequests(eq("tenant-default"), anyLong(), any()))
                .thenReturn(List.of(entity));

        StepVerifier.create(service.findSlowRequests(1000L, "tenant-default", 10))
                .assertNext(list -> assertThat(list).hasSize(1))
                .verifyComplete();
    }

    @Test
    void findByTraceId_returnsCallChain() {
        GwAuditLogEntity e1 = sample();
        when(repository.findByTraceIdOrderByCreatedAtAsc("trace-1"))
                .thenReturn(List.of(e1, sample()));

        StepVerifier.create(service.findByTraceId("trace-1"))
                .assertNext(list -> assertThat(list).hasSize(2))
                .verifyComplete();
    }

    @Test
    void getStatistics_aggregatesByPath() {
        Object[] aggregate = new Object[]{
                "/api/v1/test",
                100L,
                50.0,
                200L,
                5L
        };

        when(repository.aggregateLatency(anyString(), any(), any(), any()))
                .thenReturn(List.of(aggregate));

        StepVerifier.create(service.getStatistics("tenant-default",
                        LocalDateTime.now().minusDays(1), LocalDateTime.now()))
                .assertNext(stats -> {
                    assertThat(stats.getTotalRequests()).isEqualTo(100L);
                    assertThat(stats.getTotalErrors()).isEqualTo(5L);
                    assertThat(stats.getPerPath()).hasSize(1);
                    assertThat(stats.getPerPath().get(0).getErrorRate()).isEqualTo(0.05);
                })
                .verifyComplete();
    }

    private GwAuditLogEntity sample() {
        return GwAuditLogEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .path("/api/v1/test")
                .method("GET")
                .statusCode(200)
                .durationMs(120L)
                .userId("user-1")
                .traceId("trace-1")
                .isError(false)
                .createdAt(LocalDateTime.now())
                .build();
    }
}
