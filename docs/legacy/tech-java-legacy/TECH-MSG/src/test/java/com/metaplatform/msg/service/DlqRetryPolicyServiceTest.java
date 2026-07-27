package com.metaplatform.msg.service;

import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.dto.CleanupResponse;
import com.metaplatform.msg.dto.RetryPolicyResponse;
import com.metaplatform.msg.entity.DlqMessageEntity;
import com.metaplatform.msg.entity.DlqRetryPolicyEntity;
import com.metaplatform.msg.repository.DlqMessageRepository;
import com.metaplatform.msg.repository.DlqRetryPolicyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DlqRetryPolicyServiceTest {

    @Mock
    private DlqRetryPolicyRepository retryPolicyRepository;

    @Mock
    private DlqMessageRepository dlqMessageRepository;

    @InjectMocks
    private DlqRetryPolicyService dlqRetryPolicyService;

    @Test
    void createOrUpdate_shouldCreateNewPolicy_whenNotExists() {
        when(retryPolicyRepository.findByTenantIdAndTopic("tenant-default", "test-topic"))
                .thenReturn(Optional.empty());
        when(retryPolicyRepository.save(any(DlqRetryPolicyEntity.class)))
                .thenAnswer(inv -> {
                    DlqRetryPolicyEntity e = inv.getArgument(0);
                    return e;
                });

        RetryPolicyResponse response = dlqRetryPolicyService.createOrUpdate(
                "tenant-default", "test-topic", 5, 120, 3.0, 60);

        assertThat(response.getTopic()).isEqualTo("test-topic");
        assertThat(response.getMaxRetries()).isEqualTo(5);
        assertThat(response.getRetryIntervalSeconds()).isEqualTo(120);
        assertThat(response.getRetryBackoffMultiplier()).isEqualTo(3.0);
        assertThat(response.getAutoCleanupDays()).isEqualTo(60);
    }

    @Test
    void getByTopic_shouldThrow_whenNotFound() {
        when(retryPolicyRepository.findByTenantIdAndTopic("tenant-default", "nonexistent"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> dlqRetryPolicyService.getByTopic("tenant-default", "nonexistent"))
                .isInstanceOf(MsgException.class)
                .hasMessageContaining("DLQ 重试策略不存在");
    }

    @Test
    void applyRetry_shouldCalculateNextRetryTime() {
        DlqMessageEntity message = DlqMessageEntity.builder()
                .id("dlq-1")
                .tenantId("tenant-default")
                .originalTopic("test-topic")
                .retryCount(2)
                .status(DlqMessageEntity.DlqStatus.PENDING)
                .build();

        DlqRetryPolicyEntity policy = buildPolicy("policy-1", "test-topic");

        when(dlqMessageRepository.findById("dlq-1")).thenReturn(Optional.of(message));
        when(retryPolicyRepository.findByTenantIdAndTopic("tenant-default", "test-topic"))
                .thenReturn(Optional.of(policy));
        when(dlqMessageRepository.save(any(DlqMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        Instant before = Instant.now();
        Instant nextRetryAt = dlqRetryPolicyService.applyRetry("dlq-1");
        Instant after = Instant.now().plusSeconds(300);

        assertThat(nextRetryAt).isAfter(before);
        assertThat(message.getNextRetryAt()).isEqualTo(nextRetryAt);
    }

    @Test
    void cleanupExpired_shouldDeleteExpiredMessages() {
        DlqRetryPolicyEntity policy = buildPolicy("policy-1", "test-topic");
        policy.setAutoCleanupDays(10);

        when(retryPolicyRepository.findByTenantId("tenant-default"))
                .thenReturn(List.of(policy));

        DlqMessageEntity expiredMsg = DlqMessageEntity.builder()
                .id("dlq-expired")
                .tenantId("tenant-default")
                .originalTopic("test-topic")
                .status(DlqMessageEntity.DlqStatus.RESENT)
                .updatedAt(Instant.now().minus(20, ChronoUnit.DAYS))
                .build();

        DlqMessageEntity freshMsg = DlqMessageEntity.builder()
                .id("dlq-fresh")
                .tenantId("tenant-default")
                .originalTopic("test-topic")
                .status(DlqMessageEntity.DlqStatus.RESENT)
                .updatedAt(Instant.now().minus(1, ChronoUnit.DAYS))
                .build();

        when(dlqMessageRepository.findByTenantIdAndStatusIn("tenant-default",
                List.of(DlqMessageEntity.DlqStatus.RESENT, DlqMessageEntity.DlqStatus.DEAD)))
                .thenReturn(List.of(expiredMsg, freshMsg));
        when(dlqMessageRepository.deleteByIds(List.of("dlq-expired"))).thenReturn(1);

        CleanupResponse response = dlqRetryPolicyService.cleanupExpired("tenant-default");

        assertThat(response.getDeletedCount()).isEqualTo(1);
        verify(dlqMessageRepository).deleteByIds(List.of("dlq-expired"));
    }

    @Test
    void list_shouldReturnAllPolicies() {
        DlqRetryPolicyEntity policy1 = buildPolicy("policy-1", "topic-1");
        DlqRetryPolicyEntity policy2 = buildPolicy("policy-2", "topic-2");

        when(retryPolicyRepository.findByTenantId("tenant-default"))
                .thenReturn(List.of(policy1, policy2));

        List<RetryPolicyResponse> result = dlqRetryPolicyService.list("tenant-default");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getTopic()).isEqualTo("topic-1");
        assertThat(result.get(1).getTopic()).isEqualTo("topic-2");
    }

    @Test
    void delete_shouldRemovePolicy_whenExists() {
        DlqRetryPolicyEntity policy = buildPolicy("policy-1", "test-topic");
        when(retryPolicyRepository.findById("policy-1")).thenReturn(Optional.of(policy));

        dlqRetryPolicyService.delete("policy-1");

        verify(retryPolicyRepository).delete(policy);
    }

    private DlqRetryPolicyEntity buildPolicy(String id, String topic) {
        return DlqRetryPolicyEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .topic(topic)
                .maxRetries(3)
                .retryIntervalSeconds(60)
                .retryBackoffMultiplier(2.0)
                .autoCleanupDays(30)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
