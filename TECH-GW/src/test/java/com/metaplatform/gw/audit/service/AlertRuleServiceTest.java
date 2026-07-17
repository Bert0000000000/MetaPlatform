package com.metaplatform.gw.audit.service;

import com.metaplatform.gw.audit.dto.AlertRuleResponse;
import com.metaplatform.gw.audit.dto.CreateAlertRuleRequest;
import com.metaplatform.gw.audit.entity.GwAuditAlertRuleEntity;
import com.metaplatform.gw.audit.repository.GwAuditAlertRuleRepository;
import com.metaplatform.gw.common.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.test.StepVerifier;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertRuleServiceTest {

    @Mock
    private GwAuditAlertRuleRepository repository;

    @InjectMocks
    private AlertRuleService service;

    @Test
    void create_persistsEntity() {
        when(repository.save(any(GwAuditAlertRuleEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateAlertRuleRequest request = CreateAlertRuleRequest.builder()
                .name("slow requests > 1s")
                .conditionType("SLOW_REQUEST")
                .thresholdMs(1000L)
                .enabled(true)
                .build();

        StepVerifier.create(service.create(request))
                .assertNext(r -> {
                    assertThat(r.getConditionType()).isEqualTo("SLOW_REQUEST");
                    assertThat(r.getEnabled()).isTrue();
                })
                .verifyComplete();
    }

    @Test
    void create_rejectsInvalidType() {
        CreateAlertRuleRequest request = CreateAlertRuleRequest.builder()
                .name("bad")
                .conditionType("INVALID_TYPE")
                .build();

        StepVerifier.create(service.create(request))
                .expectErrorSatisfies(err -> {
                    assertThat(err).isInstanceOf(AlertRuleService.AlertRuleException.class);
                    assertThat(((AlertRuleService.AlertRuleException) err).getErrorCode())
                            .isEqualTo(ErrorCode.INVALID_FIELD_VALUE);
                })
                .verify();
    }

    @Test
    void list_returnsPagedResults() {
        GwAuditAlertRuleEntity entity = sample();
        org.springframework.data.domain.Page<GwAuditAlertRuleEntity> page =
                new org.springframework.data.domain.PageImpl<>(List.of(entity));
        when(repository.findByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(eq("tenant-default"), any()))
                .thenReturn(page);

        StepVerifier.create(service.list(1, 20, "tenant-default"))
                .assertNext(p -> {
                    assertThat(p.getItems()).hasSize(1);
                    assertThat(p.getTotal()).isEqualTo(1L);
                })
                .verifyComplete();
    }

    @Test
    void get_returnsRule() {
        UUID id = UUID.randomUUID();
        when(repository.findByIdAndDeletedAtIsNull(id))
                .thenReturn(Optional.of(sample()));

        StepVerifier.create(service.get(id))
                .assertNext(r -> assertThat(r.getConditionType()).isEqualTo("SLOW_REQUEST"))
                .verifyComplete();
    }

    @Test
    void delete_marksDeletedAt() {
        UUID id = UUID.randomUUID();
        GwAuditAlertRuleEntity entity = sample();
        when(repository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StepVerifier.create(service.delete(id)).verifyComplete();

        verify(repository, times(1)).save(any(GwAuditAlertRuleEntity.class));
    }

    @Test
    void checkSlowRequests_returnsTrueWhenMatching() {
        GwAuditAlertRuleEntity rule = sample();
        rule.setThresholdMs(1000L);
        rule.setEnabled(true);
        when(repository.findByEnabledAndDeletedAtIsNull(true))
                .thenReturn(List.of(rule));

        StepVerifier.create(service.checkSlowRequests(2000L))
                .assertNext(matched -> assertThat(matched).isTrue())
                .verifyComplete();
    }

    @Test
    void checkSlowRequests_returnsFalseWhenUnderThreshold() {
        GwAuditAlertRuleEntity rule = sample();
        rule.setThresholdMs(5000L);
        rule.setEnabled(true);
        when(repository.findByEnabledAndDeletedAtIsNull(true))
                .thenReturn(List.of(rule));

        StepVerifier.create(service.checkSlowRequests(200L))
                .assertNext(matched -> assertThat(matched).isFalse())
                .verifyComplete();
    }

    private GwAuditAlertRuleEntity sample() {
        return GwAuditAlertRuleEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("test rule")
                .conditionType("SLOW_REQUEST")
                .thresholdMs(1000L)
                .enabled(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
