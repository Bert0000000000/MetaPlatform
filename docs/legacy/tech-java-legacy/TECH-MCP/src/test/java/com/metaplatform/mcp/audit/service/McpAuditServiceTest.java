package com.metaplatform.mcp.audit.service;

import com.metaplatform.mcp.audit.dto.AnalyticsItem;
import com.metaplatform.mcp.audit.dto.AuditLogResponse;
import com.metaplatform.mcp.audit.dto.AuditLogStatistics;
import com.metaplatform.mcp.audit.dto.TrendPoint;
import com.metaplatform.mcp.audit.entity.McpAuditLogEntity;
import com.metaplatform.mcp.audit.repository.McpAuditLogRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class McpAuditServiceTest {

    @Mock
    private McpAuditLogRepository repository;

    private McpAuditService service;

    @BeforeEach
    void setUp() {
        service = new McpAuditService(repository);
    }

    private McpAuditLogEntity sampleEntity() {
        return McpAuditLogEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .toolCode("tool-1")
                .invocationType("DIRECT")
                .inputTokens(10)
                .outputTokens(20)
                .durationMs(100L)
                .status("SUCCESS")
                .calledAt(Instant.now())
                .build();
    }

    @Test
    void record_persists_entity() {
        when(repository.save(any(McpAuditLogEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        McpAuditLogEntity entity = McpAuditLogEntity.builder()
                .toolCode("tool-1").durationMs(50L).status("SUCCESS")
                .inputTokens(0).outputTokens(0).build();
        AuditLogResponse response = service.record(entity);
        assertThat(response.getToolCode()).isEqualTo("tool-1");
        assertThat(response.getCalledAt()).isNotNull();
    }

    @Test
    void query_returns_page() {
        McpAuditLogEntity e = sampleEntity();
        Page<McpAuditLogEntity> page = new PageImpl<>(List.of(e), PageRequest.of(0, 20), 1);
        when(repository.search(eq("tenant-default"), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<AuditLogResponse> response = service.query(null, null, null, null, null, null, 1, 20);
        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getTotal()).isEqualTo(1);
    }

    @Test
    void get_by_id_returns_entity() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.of(sampleEntity()));
        AuditLogResponse response = service.get(id);
        assertThat(response.getToolCode()).isEqualTo("tool-1");
    }

    @Test
    void get_by_id_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.AUDIT_LOG_NOT_FOUND);
    }

    @Test
    void statistics_aggregates_data() {
        when(repository.countByStatus(eq("tenant-default"), any(), any()))
                .thenReturn(List.of(new Object[]{"SUCCESS", 8L}, new Object[]{"FAILED", 2L}));
        when(repository.countByTool(eq("tenant-default"), any(), any()))
                .thenReturn(List.of(new Object[]{"tool-1", 5L}, new Object[]{"tool-2", 5L}));
        when(repository.aggregate(eq("tenant-default"), any(), any()))
                .thenReturn(new Object[]{100L, 200L, 50.0});

        AuditLogStatistics stats = service.statistics(null, null);
        assertThat(stats.getTotalCalls()).isEqualTo(10);
        assertThat(stats.getSuccessCount()).isEqualTo(8);
        assertThat(stats.getFailureCount()).isEqualTo(2);
        assertThat(stats.getSuccessRate()).isEqualTo(0.8);
        assertThat(stats.getAvgDuration()).isEqualTo(50.0);
        assertThat(stats.getTotalTokens()).isEqualTo(300L);
    }

    @Test
    void trends_returns_time_series() {
        Instant now = Instant.now();
        when(repository.trendDetailed(eq("tenant-default"), eq("hour"), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(
                        new Object[]{now, 5L, 1L, 100L, 50.0},
                        new Object[]{now.plusSeconds(3600), 8L, 0L, 200L, 60.0}));

        List<TrendPoint> points = service.trends("hour", null, null, null, null, null, null);
        assertThat(points).hasSize(2);
        assertThat(points.get(0).getCount()).isEqualTo(5L);
        assertThat(points.get(0).getErrorCount()).isEqualTo(1L);
        assertThat(points.get(0).getTokenCount()).isEqualTo(100L);
    }

    @Test
    void analytics_returns_items_by_dimension() {
        when(repository.analyticsByServer(eq("tenant-default"), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{UUID.randomUUID(), 10L, 1L, 100L, 50.0}));

        List<AnalyticsItem> items = service.analytics("server", null, null, null, null, null, null);
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getDimension()).isEqualTo("server");
    }

    @Test
    void trace_returns_same_trace_logs() {
        McpAuditLogEntity root = sampleEntity();
        root.setTraceId("trace-1");
        when(repository.findByIdAndTenantId(root.getId(), "tenant-default")).thenReturn(Optional.of(root));
        when(repository.findByTraceIdAndTenantId("tenant-default", "trace-1"))
                .thenReturn(List.of(root));

        List<AuditLogResponse> chain = service.trace(root.getId());
        assertThat(chain).hasSize(1);
        assertThat(chain.get(0).getTraceId()).isEqualTo("trace-1");
    }

    @Test
    void export_csv_returns_bytes() {
        when(repository.findAllForExport(eq("tenant-default"), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of(sampleEntity()));

        byte[] bytes = service.export(null, null, null, null, null, null, "csv");
        String content = new String(bytes);
        assertThat(content).contains("tool-1");
        assertThat(content).startsWith("id,tool_code,server_id");
    }

    @Test
    void export_xlsx_returns_bytes() {
        when(repository.findAllForExport(eq("tenant-default"), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of(sampleEntity()));

        byte[] bytes = service.export(null, null, null, null, null, null, "xlsx");
        assertThat(bytes).hasSizeGreaterThan(0);
        assertThat(bytes[0]).isEqualTo((byte) 0x50);
        assertThat(bytes[1]).isEqualTo((byte) 0x4B);
    }
}
