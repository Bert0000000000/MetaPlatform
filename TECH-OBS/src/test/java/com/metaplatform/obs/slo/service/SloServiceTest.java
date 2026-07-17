package com.metaplatform.obs.slo.service;

import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.config.ObsPrometheusProperties;
import com.metaplatform.obs.exception.ObsException;
import com.metaplatform.obs.slo.dto.ErrorBudget;
import com.metaplatform.obs.slo.dto.SloReport;
import com.metaplatform.obs.slo.dto.SloRequest;
import com.metaplatform.obs.slo.entity.SloEntity;
import com.metaplatform.obs.slo.repository.SloRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SloServiceTest {

    @Mock
    private SloRepository sloRepository;

    @Mock
    private RestTemplate prometheusRestTemplate;

    private SloService service;
    private ObsPrometheusProperties prometheusProperties;

    @BeforeEach
    void setUp() {
        prometheusProperties = new ObsPrometheusProperties();
        prometheusProperties.setBaseUrl("http://prometheus:9090");
        service = new SloService(sloRepository, prometheusProperties, prometheusRestTemplate);
        TenantContext.set("tenant-test");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("create 校验失败应抛错")
    void shouldRejectInvalidCreate() {
        SloRequest req = SloRequest.builder()
                .sliType("WRONG").sliQuery("up").target(99.9).build();
        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("create 应填充默认 window + totalBudget")
    void shouldCreateSlo() {
        SloRequest req = SloRequest.builder()
                .name("API 可用性")
                .serviceName("tech-iam")
                .sliType("AVAILABILITY")
                .sliQuery("up{job=\"tech-iam\"}")
                .target(99.9)
                .build();
        when(sloRepository.insert(any(SloEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SloEntity entity = service.create(req);
        assertThat(entity.getWindow()).isEqualTo("30d");
        assertThat(entity.getErrorBudgetTotal()).isCloseTo(0.1, within(0.0001));
        assertThat(entity.getStatus()).isEqualTo("HEALTHY");
    }

    @Test
    @DisplayName("get 缺失应抛错")
    void shouldRejectMissingSlo() {
        UUID id = UUID.randomUUID();
        when(sloRepository.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(id)).isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("calculateTotalBudget 应返回 100 - target")
    void shouldCalculateTotalBudget() {
        assertThat(service.calculateTotalBudget(99.9)).isCloseTo(0.1, within(0.0001));
        assertThat(service.calculateTotalBudget(99.0)).isEqualTo(1.0);
        assertThat(service.calculateTotalBudget(100.0)).isEqualTo(0.0);
    }

    @Test
    @DisplayName("computeConsumedBudget 应按失败率比例计算")
    void shouldComputeConsumedBudget() {
        // target=99.9 -> allowed failure = 0.1, actual 99.0 -> 1.0 -> consumed 1000%
        double consumed = service.computeConsumedBudget(99.9, 99.0, "30d");
        assertThat(consumed).isEqualTo(100.0);
        // actual equals target -> 0 consumed
        assertThat(service.computeConsumedBudget(99.9, 99.9, "30d")).isEqualTo(0.0);
        // actual above target -> 0 consumed
        assertThat(service.computeConsumedBudget(99.9, 99.95, "30d")).isEqualTo(0.0);
    }

    @Test
    @DisplayName("computeBurnRate 应按天数归一化")
    void shouldComputeBurnRate() {
        assertThat(service.computeBurnRate(30.0, 100.0, "7d")).isEqualTo(30.0 / 7);
        assertThat(service.computeBurnRate(15.0, 50.0, "30d")).isEqualTo(15.0 / 30);
        assertThat(service.computeBurnRate(50.0, 0.0, "30d")).isEqualTo(0.0);
    }

    @Test
    @DisplayName("deriveStatus 应根据目标差距返回 HEALTHY/AT_RISK/EXHAUSTED")
    void shouldDeriveStatus() {
        assertThat(service.deriveStatus(99.9, 99.95, 0.1)).isEqualTo("HEALTHY");
        assertThat(service.deriveStatus(99.9, 99.5, 2.0)).isEqualTo("AT_RISK");
        assertThat(service.deriveStatus(99.9, 89.0, 5.0)).isEqualTo("EXHAUSTED");
    }

    @Test
    @DisplayName("generateReport 应返回包含 errorBudget 与状态摘要的报告")
    void shouldGenerateReport() {
        UUID id = UUID.randomUUID();
        SloEntity existing = SloEntity.builder()
                .id(id)
                .tenantId("tenant-test")
                .name("API 可用性")
                .serviceName("tech-iam")
                .sliType("AVAILABILITY")
                .sliQuery("up{job=\"tech-iam\"}")
                .target(99.9)
                .window("30d")
                .errorBudgetTotal(0.1)
                .errorBudgetConsumed(0.0)
                .burnRate(0.0)
                .status("HEALTHY")
                .build();
        when(sloRepository.findById(id)).thenReturn(Optional.of(existing));
        when(sloRepository.update(any(SloEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(prometheusRestTemplate.exchange(anyString(), any(), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(
                        "{\"status\":\"success\",\"data\":{\"result\":[{\"value\":[0,\"0.99\"]}]}}"));

        SloReport report = service.generateReport(id, "30d");
        assertThat(report.getServiceName()).isEqualTo("tech-iam");
        assertThat(report.getTarget()).isEqualTo(99.9);
        assertThat(report.getActualAvailability()).isEqualTo(99.0);
        assertThat(report.getErrorBudget().getConsumedBudget()).isGreaterThan(0.0);
        assertThat(report.getStatus()).isIn("AT_RISK", "EXHAUSTED");
    }

    @Test
    @DisplayName("generateReport 非法 period 应抛错")
    void shouldRejectInvalidPeriod() {
        UUID id = UUID.randomUUID();
        SloEntity existing = SloEntity.builder().id(id).tenantId("tenant-test")
                .serviceName("tech-iam").sliType("AVAILABILITY").sliQuery("up")
                .target(99.9).window("30d").errorBudgetTotal(0.1).build();
        when(sloRepository.findById(id)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.generateReport(id, "1d"))
                .isInstanceOf(ObsException.class);
    }

    @Test
    @DisplayName("getErrorBudget 应基于 target 与已消耗计算剩余")
    void shouldGetErrorBudget() {
        UUID id = UUID.randomUUID();
        SloEntity existing = SloEntity.builder()
                .id(id).tenantId("tenant-test")
                .serviceName("tech-iam").sliType("AVAILABILITY").sliQuery("up")
                .target(99.0).window("30d")
                .errorBudgetTotal(1.0).errorBudgetConsumed(0.3).burnRate(0.01).build();
        when(sloRepository.findById(id)).thenReturn(Optional.of(existing));

        ErrorBudget budget = service.getErrorBudget(id);
        assertThat(budget.getTotalBudget()).isEqualTo(1.0);
        assertThat(budget.getConsumedBudget()).isEqualTo(0.3);
        assertThat(budget.getRemainingBudget()).isEqualTo(0.7);
    }

    @Test
    @DisplayName("list 应返回当前租户的 SLO")
    void shouldListSlos() {
        when(sloRepository.findAll("tenant-test")).thenReturn(List.of(
                SloEntity.builder().id(UUID.randomUUID()).name("A").build(),
                SloEntity.builder().id(UUID.randomUUID()).name("B").build()));
        assertThat(service.list()).hasSize(2);
    }

    @Test
    @DisplayName("delete 缺失应抛错")
    void shouldRejectDeleteMissing() {
        UUID id = UUID.randomUUID();
        when(sloRepository.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.delete(id)).isInstanceOf(ObsException.class);
    }
}