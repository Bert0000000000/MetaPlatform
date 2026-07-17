package com.metaplatform.ea.debt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.debt.dto.CreateTechDebtRequest;
import com.metaplatform.ea.debt.dto.TechDebtImpactResponse;
import com.metaplatform.ea.debt.dto.TechDebtResponse;
import com.metaplatform.ea.debt.dto.UpdateTechDebtRequest;
import com.metaplatform.ea.debt.entity.TechDebtEntity;
import com.metaplatform.ea.debt.repository.TechDebtRepository;
import com.metaplatform.ea.exception.EaException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TechDebtServiceTest {

    @Mock
    private TechDebtRepository repository;

    @Mock
    private ApplicationRepository applicationRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private TechDebtService service;

    private UUID debtId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        debtId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldDefaultSeverityAndStatus() {
        CreateTechDebtRequest request = new CreateTechDebtRequest();
        request.setTitle("升级 Spring Boot 版本");
        request.setCode("DEBT-SPRING-001");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "DEBT-SPRING-001"))
                .thenReturn(false);
        ArgumentCaptor<TechDebtEntity> captor = ArgumentCaptor.forClass(TechDebtEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        TechDebtResponse response = service.create(request);

        assertThat(captor.getValue().getSeverity()).isEqualTo("MEDIUM");
        assertThat(captor.getValue().getStatus()).isEqualTo("OPEN");
        assertThat(response.getCode()).isEqualTo("DEBT-SPRING-001");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateTechDebtRequest request = new CreateTechDebtRequest();
        request.setTitle("x");
        request.setCode("DEBT-001");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "DEBT-001"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("技术债编码已存在");
    }

    @Test
    void create_shouldThrow_whenInvalidSeverity() {
        CreateTechDebtRequest request = new CreateTechDebtRequest();
        request.setTitle("x");
        request.setCode("DEBT-002");
        request.setSeverity("INVALID");

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("severity");
    }

    @Test
    void create_shouldThrow_whenScopeWithoutType() {
        CreateTechDebtRequest request = new CreateTechDebtRequest();
        request.setTitle("x");
        request.setCode("DEBT-003");
        request.setScopeId(UUID.randomUUID());

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("scopeType");
    }

    @Test
    void list_shouldFilterBySeverity() {
        TechDebtEntity entity = buildEntity(debtId, "CRITICAL");
        when(repository.findByTenantIdAndSeverityAndDeletedAtIsNull("tenant-default", "CRITICAL"))
                .thenReturn(List.of(entity));

        List<TechDebtResponse> result = service.list("CRITICAL", null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getSeverity()).isEqualTo("CRITICAL");
    }

    @Test
    void update_shouldTransitionStatus() {
        TechDebtEntity entity = buildEntity(debtId, "OPEN");
        when(repository.findByIdAndDeletedAtIsNull(debtId)).thenReturn(Optional.of(entity));
        when(repository.save(any(TechDebtEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateTechDebtRequest request = new UpdateTechDebtRequest();
        request.setStatus("RESOLVED");
        request.setRemediation("已升级到最新版本");

        TechDebtResponse response = service.update(debtId, request);

        assertThat(response.getStatus()).isEqualTo("RESOLVED");
        assertThat(response.getRemediation()).isEqualTo("已升级到最新版本");
    }

    @Test
    void analyzeImpact_shouldReturnAffectedApps() {
        TechDebtEntity entity = buildEntity(debtId, "CRITICAL");
        entity.setScopeType("APPLICATION");
        entity.setScopeId(UUID.randomUUID());
        when(repository.findByIdAndDeletedAtIsNull(debtId)).thenReturn(Optional.of(entity));
        when(applicationRepository.findByIdAndDeletedAtIsNull(entity.getScopeId()))
                .thenReturn(Optional.empty());

        TechDebtImpactResponse response = service.analyzeImpact(debtId);

        assertThat(response.getSeverity()).isEqualTo("CRITICAL");
        assertThat(response.getRecommendations()).isNotEmpty();
        assertThat(response.getSummary()).contains("DEBT-SPRING-001");
    }

    @Test
    void delete_shouldSoftDelete() {
        TechDebtEntity entity = buildEntity(debtId, "OPEN");
        when(repository.findByIdAndDeletedAtIsNull(debtId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<TechDebtEntity> captor = ArgumentCaptor.forClass(TechDebtEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(debtId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private TechDebtEntity buildEntity(UUID id, String severity) {
        return TechDebtEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .title("升级 Spring Boot")
                .code("DEBT-SPRING-001")
                .category("TECH_UPGRADE")
                .severity(severity)
                .status("OPEN")
                .description("升级到最新 LTS 版本")
                .impactScore(80)
                .owner("platform-team")
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}