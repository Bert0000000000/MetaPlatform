package com.metaplatform.mcp.alert.service;

import com.metaplatform.mcp.alert.dto.AlertRuleResponse;
import com.metaplatform.mcp.alert.dto.CreateAlertRuleRequest;
import com.metaplatform.mcp.alert.dto.UpdateAlertRuleRequest;
import com.metaplatform.mcp.alert.entity.McpAlertRuleEntity;
import com.metaplatform.mcp.alert.repository.McpAlertRuleRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class McpAlertRuleServiceTest {

    @Mock
    private McpAlertRuleRepository repository;

    private McpAlertRuleService service;

    @BeforeEach
    void setUp() {
        service = new McpAlertRuleService(repository);
    }

    private McpAlertRuleEntity sampleEntity() {
        return McpAlertRuleEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("失败率告警")
                .metric("error_rate")
                .threshold(BigDecimal.valueOf(0.05))
                .windowMinutes(5)
                .enabled(true)
                .notifyChannels("email,webhook")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void create_persists_rule() {
        when(repository.save(any(McpAlertRuleEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateAlertRuleRequest request = CreateAlertRuleRequest.builder()
                .name("失败率告警")
                .metric("error_rate")
                .threshold(BigDecimal.valueOf(0.05))
                .windowMinutes(5)
                .enabled(true)
                .notifyChannels(List.of("email", "webhook"))
                .build();

        AlertRuleResponse response = service.create(request);
        assertThat(response.getName()).isEqualTo("失败率告警");
        assertThat(response.getNotifyChannels()).containsExactly("email", "webhook");
    }

    @Test
    void update_modifies_rule() {
        McpAlertRuleEntity entity = sampleEntity();
        when(repository.findByIdAndTenantId(entity.getId(), "tenant-default")).thenReturn(Optional.of(entity));
        when(repository.save(any(McpAlertRuleEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateAlertRuleRequest request = UpdateAlertRuleRequest.builder()
                .name("更新后")
                .metric("avg_duration")
                .threshold(BigDecimal.valueOf(1000))
                .windowMinutes(10)
                .enabled(false)
                .notifyChannels(List.of("webhook"))
                .build();

        AlertRuleResponse response = service.update(entity.getId(), request);
        assertThat(response.getName()).isEqualTo("更新后");
        assertThat(response.getEnabled()).isFalse();
    }

    @Test
    void toggle_changes_enabled() {
        McpAlertRuleEntity entity = sampleEntity();
        when(repository.findByIdAndTenantId(entity.getId(), "tenant-default")).thenReturn(Optional.of(entity));
        when(repository.save(any(McpAlertRuleEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AlertRuleResponse response = service.toggle(entity.getId(), false);
        assertThat(response.getEnabled()).isFalse();
    }

    @Test
    void get_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(repository.findByIdAndTenantId(id, "tenant-default")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ALERT_RULE_NOT_FOUND);
    }
}
