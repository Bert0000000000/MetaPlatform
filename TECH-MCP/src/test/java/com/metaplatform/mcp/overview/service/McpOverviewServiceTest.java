package com.metaplatform.mcp.overview.service;

import com.metaplatform.mcp.audit.entity.McpAuditLogEntity;
import com.metaplatform.mcp.audit.repository.McpAuditLogRepository;
import com.metaplatform.mcp.overview.dto.OverviewResponse;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class McpOverviewServiceTest {

    @Mock
    private McpServerRepository mcpServerRepository;
    @Mock
    private McpToolRepository mcpToolRepository;
    @Mock
    private McpAuditLogRepository auditLogRepository;

    private McpOverviewService service;

    @BeforeEach
    void setUp() {
        service = new McpOverviewService(mcpServerRepository, mcpToolRepository, auditLogRepository);
    }

    @Test
    void overview_aggregates_all_sections() {
        when(mcpServerRepository.countByStatus("tenant-default"))
                .thenReturn(List.of(new Object[]{"ACTIVE", 2L}, new Object[]{"INACTIVE", 1L}));
        when(mcpToolRepository.countByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(5L);
        when(mcpToolRepository.countByTenantIdAndEnabledTrueAndDeletedAtIsNull("tenant-default")).thenReturn(3L);
        when(mcpToolRepository.countByTenantIdAndEnabledFalseAndDeletedAtIsNull("tenant-default")).thenReturn(2L);
        when(auditLogRepository.aggregate(eq("tenant-default"), any(Instant.class), any(Instant.class)))
                .thenReturn(new Object[]{100L, 200L, 75.0});
        when(auditLogRepository.countByStatus(eq("tenant-default"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(new Object[]{"SUCCESS", 8L}, new Object[]{"FAILED", 2L}));
        when(auditLogRepository.countByTool(eq("tenant-default"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(new Object[]{"tool-1", 5L}, new Object[]{"tool-2", 3L}));

        Instant now = Instant.now();
        when(auditLogRepository.trendWithTokensByInterval(eq("tenant-default"), eq("hour"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(
                        new Object[]{java.sql.Timestamp.from(now), 4L, 120L},
                        new Object[]{java.sql.Timestamp.from(now.plusSeconds(3600)), 6L, 180L}
                ));
        when(auditLogRepository.findRecentErrors(eq("tenant-default"), any(Instant.class), any(PageRequest.class)))
                .thenReturn(List.of(
                        McpAuditLogEntity.builder()
                                .id(UUID.randomUUID())
                                .toolCode("tool-1")
                                .status("FAILED")
                                .errorMessage("connection refused")
                                .traceId("trace-1")
                                .calledAt(now)
                                .build(),
                        McpAuditLogEntity.builder()
                                .id(UUID.randomUUID())
                                .toolCode("tool-2")
                                .status("TIMEOUT")
                                .errorMessage("read timeout")
                                .traceId("trace-2")
                                .calledAt(now)
                                .build()
                ));

        OverviewResponse response = service.overview();

        assertThat(response.getServerStats().getTotal()).isEqualTo(3L);
        assertThat(response.getServerStats().getOnline()).isEqualTo(2L);
        assertThat(response.getServerStats().getOffline()).isEqualTo(1L);
        assertThat(response.getServerStats().getError()).isEqualTo(0L);

        assertThat(response.getToolStats().getTotal()).isEqualTo(5L);
        assertThat(response.getToolStats().getEnabled()).isEqualTo(3L);
        assertThat(response.getToolStats().getDisabled()).isEqualTo(2L);

        assertThat(response.getCallStats().getTodayCalls()).isEqualTo(10L);
        assertThat(response.getCallStats().getSuccessRate()).isEqualTo(0.8);
        assertThat(response.getCallStats().getAvgDuration()).isEqualTo(75.0);

        assertThat(response.getTokenStats().getTodayInputTokens()).isEqualTo(100L);
        assertThat(response.getTokenStats().getTodayOutputTokens()).isEqualTo(200L);
        assertThat(response.getTokenStats().getTodayTotalTokens()).isEqualTo(300L);

        assertThat(response.getErrorAlerts()).hasSize(2);
        assertThat(response.getErrorAlerts().get(0).getToolCode()).isEqualTo("tool-1");
        assertThat(response.getErrorAlerts().get(0).getLevel()).isEqualTo("error");
        assertThat(response.getErrorAlerts().get(1).getLevel()).isEqualTo("warning");

        assertThat(response.getTopTools()).hasSize(2);
        assertThat(response.getTopTools().get(0).getToolCode()).isEqualTo("tool-1");
        assertThat(response.getTopTools().get(0).getCount()).isEqualTo(5L);

        assertThat(response.getCallTrend()).hasSize(2);
        assertThat(response.getCallTrend().get(0).getCount()).isEqualTo(4L);
        assertThat(response.getCallTrend().get(0).getTokens()).isEqualTo(0L);

        assertThat(response.getTokenTrend()).hasSize(2);
        assertThat(response.getTokenTrend().get(0).getTokens()).isEqualTo(120L);
    }

    @Test
    void overview_with_empty_data_returns_zeros() {
        when(mcpServerRepository.countByStatus("tenant-default")).thenReturn(List.of());
        when(mcpToolRepository.countByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(0L);
        when(mcpToolRepository.countByTenantIdAndEnabledTrueAndDeletedAtIsNull("tenant-default")).thenReturn(0L);
        when(mcpToolRepository.countByTenantIdAndEnabledFalseAndDeletedAtIsNull("tenant-default")).thenReturn(0L);
        when(auditLogRepository.aggregate(eq("tenant-default"), any(Instant.class), any(Instant.class)))
                .thenReturn(new Object[]{0L, 0L, 0.0});
        when(auditLogRepository.countByStatus(eq("tenant-default"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());
        when(auditLogRepository.countByTool(eq("tenant-default"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());
        when(auditLogRepository.trendWithTokensByInterval(eq("tenant-default"), eq("hour"), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());
        when(auditLogRepository.findRecentErrors(eq("tenant-default"), any(Instant.class), any(PageRequest.class)))
                .thenReturn(List.of());

        OverviewResponse response = service.overview();

        assertThat(response.getServerStats().getTotal()).isEqualTo(0L);
        assertThat(response.getToolStats().getTotal()).isEqualTo(0L);
        assertThat(response.getCallStats().getTodayCalls()).isEqualTo(0L);
        assertThat(response.getCallStats().getSuccessRate()).isEqualTo(0.0);
        assertThat(response.getTokenStats().getTodayTotalTokens()).isEqualTo(0L);
        assertThat(response.getErrorAlerts()).isEmpty();
        assertThat(response.getTopTools()).isEmpty();
        assertThat(response.getCallTrend()).isEmpty();
        assertThat(response.getTokenTrend()).isEmpty();
    }
}
