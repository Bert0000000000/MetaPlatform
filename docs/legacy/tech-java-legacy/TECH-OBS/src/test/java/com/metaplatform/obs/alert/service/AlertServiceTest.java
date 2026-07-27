package com.metaplatform.obs.alert.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.obs.alert.dto.AlertRuleRequest;
import com.metaplatform.obs.alert.dto.AlertStatistics;
import com.metaplatform.obs.alert.dto.NotificationChannelRequest;
import com.metaplatform.obs.alert.dto.SilenceRequest;
import com.metaplatform.obs.alert.entity.AlertEntity;
import com.metaplatform.obs.alert.entity.AlertRuleEntity;
import com.metaplatform.obs.alert.entity.AlertSilenceEntity;
import com.metaplatform.obs.alert.entity.NotificationChannelEntity;
import com.metaplatform.obs.alert.repository.AlertRepository;
import com.metaplatform.obs.alert.repository.AlertRuleRepository;
import com.metaplatform.obs.alert.repository.AlertSilenceRepository;
import com.metaplatform.obs.alert.repository.NotificationChannelRepository;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.exception.ObsException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    @Mock private AlertRuleRepository ruleRepository;
    @Mock private AlertRepository alertRepository;
    @Mock private AlertSilenceRepository silenceRepository;
    @Mock private NotificationChannelRepository channelRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AlertService alertService;

    @BeforeEach
    void setUp() {
        alertService = new AlertService(ruleRepository, alertRepository, silenceRepository,
                channelRepository, objectMapper);
        TenantContext.set("tenant-test");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("createRule 校验失败应抛 INVALID_FIELD_VALUE")
    void shouldRejectInvalidRule() {
        AlertRuleRequest req = AlertRuleRequest.builder()
                .metricName("")
                .conditionOperator("BAD")
                .threshold(0.0)
                .build();
        assertThatThrownBy(() -> alertService.createRule(req))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("createRule 成功时应持久化并填充 channels JSON")
    void shouldCreateRule() {
        AlertRuleRequest req = AlertRuleRequest.builder()
                .name("CPU high")
                .metricName("cpu_usage")
                .conditionOperator("GT")
                .threshold(80.0)
                .durationSeconds(60)
                .severity("WARNING")
                .enabled(true)
                .notificationChannels(JsonNodeFactory.instance.arrayNode())
                .build();

        when(ruleRepository.insert(any(AlertRuleEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AlertRuleEntity saved = alertService.createRule(req);
        assertThat(saved.getMetricName()).isEqualTo("cpu_usage");
        assertThat(saved.getConditionOperator()).isEqualTo("GT");
        assertThat(saved.isEnabled()).isTrue();
        assertThat(saved.getNotificationChannels().isArray()).isTrue();
    }

    @Test
    @DisplayName("triggerIfMatched 应在值超过阈值时创建告警")
    void shouldTriggerAlertWhenMatched() {
        AlertRuleEntity rule = AlertRuleEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-test")
                .metricName("cpu_usage")
                .conditionOperator("GT")
                .threshold(80.0)
                .severity("WARNING")
                .enabled(true)
                .build();

        when(alertRepository.insert(any(AlertEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AlertEntity alert = alertService.triggerIfMatched(rule, 95.0);
        assertThat(alert).isNotNull();
        assertThat(alert.getStatus()).isEqualTo("FIRING");
        assertThat(alert.getValue()).isEqualTo(95.0);
        assertThat(alert.getMessage()).contains("cpu_usage");
    }

    @Test
    @DisplayName("triggerIfMatched 值未越界时应返回 null")
    void shouldNotTriggerWhenBelowThreshold() {
        AlertRuleEntity rule = AlertRuleEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-test")
                .metricName("cpu_usage")
                .conditionOperator("GT")
                .threshold(80.0)
                .severity("WARNING")
                .enabled(true)
                .build();
        assertThat(alertService.triggerIfMatched(rule, 50.0)).isNull();
    }

    @Test
    @DisplayName("matches 应正确支持五种比较运算符")
    void shouldMatchAllOperators() {
        AlertRuleEntity base = AlertRuleEntity.builder()
                .tenantId("t").metricName("x").severity("WARNING").enabled(true).build();
        base = base.toBuilder().build();

        assertThat(alertService.matches(set(base, "GT", 10), 11)).isTrue();
        assertThat(alertService.matches(set(base, "GTE", 10), 10)).isTrue();
        assertThat(alertService.matches(set(base, "LT", 10), 9)).isTrue();
        assertThat(alertService.matches(set(base, "LTE", 10), 10)).isTrue();
        assertThat(alertService.matches(set(base, "EQ", 10), 10)).isTrue();
        assertThat(alertService.matches(set(base, "GT", 10), 10)).isFalse();
    }

    @Test
    @DisplayName("silenceAlert 应创建静默记录并更新状态")
    void shouldSilenceAlert() {
        UUID alertId = UUID.randomUUID();
        AlertEntity existing = AlertEntity.builder()
                .id(alertId).tenantId("tenant-test").status("FIRING").build();
        when(alertRepository.findById(alertId)).thenReturn(Optional.of(existing));
        when(silenceRepository.insert(any(AlertSilenceEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SilenceRequest req = SilenceRequest.builder()
                .durationSeconds(3600).reason("维护中").createdBy("admin").build();
        AlertSilenceEntity silence = alertService.silenceAlert(alertId, req);

        assertThat(silence.getReason()).isEqualTo("维护中");
        assertThat(silence.getSilencedUntil()).isAfter(Instant.now());
    }

    @Test
    @DisplayName("recoverAlert 应将告警置为 RESOLVED")
    void shouldRecoverAlert() {
        UUID alertId = UUID.randomUUID();
        AlertEntity existing = AlertEntity.builder()
                .id(alertId).tenantId("tenant-test").status("FIRING").build();
        when(alertRepository.findById(alertId)).thenReturn(Optional.of(existing));

        AlertEntity recovered = alertService.recoverAlert(alertId);
        assertThat(recovered.getStatus()).isEqualTo("RESOLVED");
        assertThat(recovered.getResolvedAt()).isNotNull();
    }

    @Test
    @DisplayName("getStatistics 应汇总 firing/silenced/resolvedToday")
    void shouldComputeStatistics() {
        when(alertRepository.countByStatus("tenant-test", "FIRING")).thenReturn(3L);
        when(alertRepository.countByStatus("tenant-test", "SILENCED")).thenReturn(2L);
        when(alertRepository.countResolvedSince(anyString(), any(Instant.class))).thenReturn(5L);
        when(ruleRepository.findAll("tenant-test")).thenReturn(List.of(
                AlertRuleEntity.builder().severity("WARNING").build(),
                AlertRuleEntity.builder().severity("CRITICAL").build(),
                AlertRuleEntity.builder().severity("INFO").build()));

        AlertStatistics stats = alertService.getStatistics();
        assertThat(stats.getActive()).isEqualTo(5L);
        assertThat(stats.getFiring()).isEqualTo(3L);
        assertThat(stats.getSilenced()).isEqualTo(2L);
        assertThat(stats.getRecoveredToday()).isEqualTo(5L);
        assertThat(stats.getBySeverity()).containsEntry("WARNING", 1L);
        assertThat(stats.getBySeverity()).containsEntry("CRITICAL", 1L);
    }

    @Test
    @DisplayName("createChannel 非法类型应抛错")
    void shouldRejectInvalidChannelType() {
        NotificationChannelRequest req = NotificationChannelRequest.builder()
                .name("test").type("invalid").build();
        assertThatThrownBy(() -> alertService.createChannel(req))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("createChannel 成功时应返回带 config 的实体")
    void shouldCreateChannel() {
        ObjectNode config = JsonNodeFactory.instance.objectNode();
        config.put("url", "https://hooks.slack.com/services/X");
        NotificationChannelRequest req = NotificationChannelRequest.builder()
                .name("slack-prod").type("slack").config(config).build();

        when(channelRepository.insert(any(NotificationChannelEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        NotificationChannelEntity saved = alertService.createChannel(req);
        assertThat(saved.getType()).isEqualTo("slack");
        assertThat(saved.getConfig().get("url").asText()).isEqualTo("https://hooks.slack.com/services/X");
    }

    @Test
    @DisplayName("getHistory 必须传 ruleId")
    void shouldRequireRuleIdForHistory() {
        assertThatThrownBy(() -> alertService.getHistory(null, null, null))
                .isInstanceOf(ObsException.class);
    }

    private AlertRuleEntity set(AlertRuleEntity base, String op, double threshold) {
        return AlertRuleEntity.builder()
                .id(base.getId())
                .tenantId(base.getTenantId())
                .metricName(base.getMetricName())
                .conditionOperator(op)
                .threshold(threshold)
                .severity(base.getSeverity())
                .enabled(base.isEnabled())
                .build();
    }
}