package com.metaplatform.ea.governance.health.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapRepository;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.repository.DataEntityRepository;
import com.metaplatform.ea.dataarchitecture.repository.DataFlowRepository;
import com.metaplatform.ea.dataarchitecture.repository.DataStandardRepository;
import com.metaplatform.ea.debt.repository.TechDebtRepository;
import com.metaplatform.ea.debt.repository.TechStandardRepository;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.health.dto.*;
import com.metaplatform.ea.governance.health.repository.HealthScoreRepository;
import com.metaplatform.ea.governance.principle.repository.ArchitecturePrincipleRepository;
import com.metaplatform.ea.governance.review.repository.ReviewTicketRepository;
import com.metaplatform.ea.mapping.repository.CapabilityConceptMappingRepository;
import com.metaplatform.ea.ontmapping.repository.ConceptMappingRuleRepository;
import com.metaplatform.ea.process.repository.BusinessProcessRepository;
import com.metaplatform.ea.techarchitecture.repository.InfrastructureRepository;
import com.metaplatform.ea.techradar.repository.TechnologyRadarRepository;
import com.metaplatform.ea.techstack.repository.TechnologyStackRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamStageRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ArchitectureHealthServiceTest {

    @Mock private CapabilityMapRepository capabilityMapRepository;
    @Mock private BusinessCapabilityRepository capabilityRepository;
    @Mock private CapabilityConceptMappingRepository capabilityMappingRepository;
    @Mock private ValueStreamRepository valueStreamRepository;
    @Mock private ValueStreamStageRepository valueStreamStageRepository;
    @Mock private BusinessProcessRepository businessProcessRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private TechDebtRepository techDebtRepository;
    @Mock private DataEntityRepository dataEntityRepository;
    @Mock private DataFlowRepository dataFlowRepository;
    @Mock private DataStandardRepository dataStandardRepository;
    @Mock private TechStandardRepository techStandardRepository;
    @Mock private TechnologyStackRepository techStackRepository;
    @Mock private TechnologyRadarRepository technologyRadarRepository;
    @Mock private InfrastructureRepository infrastructureRepository;
    @Mock private ArchitecturePrincipleRepository principleRepository;
    @Mock private ReviewTicketRepository reviewTicketRepository;
    @Mock private ConceptMappingRuleRepository conceptMappingRuleRepository;
    @Mock private HealthScoreRepository healthScoreRepository;

    @Spy private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks private ArchitectureHealthService healthService;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getOverview_shouldComputeFromRepositories_whenNoCachedData() {
        when(healthScoreRepository.findByTenantIdAndScoreDate("tenant-default", LocalDate.now()))
                .thenReturn(List.of());
        stubAllRepositoriesEmpty();

        HealthOverviewResponse response = healthService.getOverview();

        assertThat(response).isNotNull();
        assertThat(response.overallScore()).isEqualTo(100.0);
        assertThat(response.dimensionScores()).hasSize(5);
        assertThat(response.dimensionScores().get("business")).isEqualTo(100.0);
        assertThat(response.assessedDate()).isEqualTo(LocalDate.now());
        assertThat(response.recentTrend()).isEmpty();
        assertThat(response.keyRisks()).isEmpty();
    }

    @Test
    void getOverview_shouldUseCachedData_whenAvailable() {
        HealthScoreEntityStub businessScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "business", 65.0);
        HealthScoreEntityStub appScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "application", 75.0);
        HealthScoreEntityStub dataScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "data", 90.0);
        HealthScoreEntityStub techScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "technology", 85.0);
        HealthScoreEntityStub govScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "governance", 100.0);

        when(healthScoreRepository.findByTenantIdAndScoreDate("tenant-default", LocalDate.now()))
                .thenReturn(List.of(businessScore, appScore, dataScore, techScore, govScore));
        when(techDebtRepository.findByTenantIdAndSeverityAndDeletedAtIsNull("tenant-default", "HIGH"))
                .thenReturn(List.of());

        HealthOverviewResponse response = healthService.getOverview();

        assertThat(response.dimensionScores().get("business")).isEqualTo(65.0);
        assertThat(response.dimensionScores().get("application")).isEqualTo(75.0);
        double expectedOverall = Math.round((65 + 75 + 90 + 85 + 100) / 5.0 * 100.0) / 100.0;
        assertThat(response.overallScore()).isEqualTo(expectedOverall);
    }

    @Test
    void getDimensionDetail_shouldReturnMetricsAndSuggestions() {
        when(capabilityMapRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(valueStreamRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(businessProcessRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());

        DimensionHealthResponse response = healthService.getDimensionDetail("business");

        assertThat(response.dimension()).isEqualTo("business");
        assertThat(response.score()).isEqualTo(100.0);
        assertThat(response.metrics()).containsKey("capabilityMapCoverage");
        assertThat(response.metrics()).containsKey("valueStreamCompleteness");
        assertThat(response.metrics()).containsKey("processDocumentationRate");
        assertThat(response.improvementSuggestions()).isEmpty();
    }

    @Test
    void getDimensionDetail_shouldThrowForInvalidDimension() {
        assertThatThrownBy(() -> healthService.getDimensionDetail("invalid"))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("维度必须为");
    }

    @Test
    void getRisks_shouldReturnHighRiskForLowScore() {
        HealthScoreEntityStub lowScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "business", 45.0);
        HealthScoreEntityStub okScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "application", 90.0);
        HealthScoreEntityStub dataScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "data", 90.0);
        HealthScoreEntityStub techScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "technology", 90.0);
        HealthScoreEntityStub govScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "governance", 90.0);

        when(healthScoreRepository.findByTenantIdAndScoreDate("tenant-default", LocalDate.now()))
                .thenReturn(List.of(lowScore, okScore, dataScore, techScore, govScore));
        when(techDebtRepository.findByTenantIdAndSeverityAndDeletedAtIsNull("tenant-default", "HIGH"))
                .thenReturn(List.of());

        List<RiskItemResponse> risks = healthService.getRisks(null);

        assertThat(risks).hasSize(1);
        assertThat(risks.get(0).severity()).isEqualTo("HIGH");
        assertThat(risks.get(0).dimension()).isEqualTo("business");
    }

    @Test
    void getRisks_shouldFilterBySeverity() {
        HealthScoreEntityStub lowScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "business", 45.0);
        HealthScoreEntityStub midScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "application", 70.0);
        HealthScoreEntityStub dataScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "data", 90.0);
        HealthScoreEntityStub techScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "technology", 90.0);
        HealthScoreEntityStub govScore = HealthScoreEntityStub.of(
                "tenant-default", LocalDate.now(), "governance", 90.0);

        when(healthScoreRepository.findByTenantIdAndScoreDate("tenant-default", LocalDate.now()))
                .thenReturn(List.of(lowScore, midScore, dataScore, techScore, govScore));
        when(techDebtRepository.findByTenantIdAndSeverityAndDeletedAtIsNull("tenant-default", "HIGH"))
                .thenReturn(List.of());

        List<RiskItemResponse> highRisks = healthService.getRisks("HIGH");
        List<RiskItemResponse> mediumRisks = healthService.getRisks("MEDIUM");

        assertThat(highRisks).hasSize(1);
        assertThat(highRisks.get(0).dimension()).isEqualTo("business");
        assertThat(mediumRisks).hasSize(1);
        assertThat(mediumRisks.get(0).dimension()).isEqualTo("application");
    }

    @Test
    void getTrends_shouldReturnCachedTrendData() {
        when(healthScoreRepository.findByTenantIdAndDimensionAndScoreDateBetweenOrderByScoreDateAsc(
                org.mockito.ArgumentMatchers.eq("tenant-default"),
                org.mockito.ArgumentMatchers.eq("overall"),
                org.mockito.ArgumentMatchers.any(LocalDate.class),
                org.mockito.ArgumentMatchers.any(LocalDate.class)))
                .thenReturn(List.of());

        HealthTrendResponse response = healthService.getTrends(30);

        assertThat(response.days()).isEqualTo(30);
        assertThat(response.trends()).isEmpty();
    }

    @Test
    void getTrends_shouldClampDaysToValidRange() {
        HealthTrendResponse response = healthService.getTrends(0);
        assertThat(response.days()).isEqualTo(1);

        response = healthService.getTrends(999);
        assertThat(response.days()).isEqualTo(365);
    }

    private void stubAllRepositoriesEmpty() {
        when(capabilityMapRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(valueStreamRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(businessProcessRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(applicationRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(techDebtRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(dataEntityRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(dataFlowRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(dataStandardRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(techStackRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(technologyRadarRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(infrastructureRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(principleRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(reviewTicketRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(techStandardRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of());
        when(techDebtRepository.findByTenantIdAndSeverityAndDeletedAtIsNull("tenant-default", "HIGH"))
                .thenReturn(List.of());
        when(healthScoreRepository.findByTenantIdAndDimensionAndScoreDateBetweenOrderByScoreDateAsc(
                org.mockito.ArgumentMatchers.eq("tenant-default"),
                org.mockito.ArgumentMatchers.eq("overall"),
                org.mockito.ArgumentMatchers.any(LocalDate.class),
                org.mockito.ArgumentMatchers.any(LocalDate.class)))
                .thenReturn(List.of());
    }

    private static class HealthScoreEntityStub extends com.metaplatform.ea.governance.health.entity.HealthScoreEntity {
        static HealthScoreEntityStub of(String tenantId, LocalDate date, String dimension, double score) {
            HealthScoreEntityStub stub = new HealthScoreEntityStub();
            stub.setTenantId(tenantId);
            stub.setScoreDate(date);
            stub.setDimension(dimension);
            stub.setScore(score);
            return stub;
        }
    }
}
