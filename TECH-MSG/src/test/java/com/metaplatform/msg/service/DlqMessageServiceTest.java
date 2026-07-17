package com.metaplatform.msg.service;

import com.metaplatform.msg.common.MsgException;
import com.metaplatform.msg.common.PageResponse;
import com.metaplatform.msg.dto.BatchResendResponse;
import com.metaplatform.msg.dto.DlqMessageResponse;
import com.metaplatform.msg.entity.DlqMessageEntity;
import com.metaplatform.msg.entity.DlqRetryPolicyEntity;
import com.metaplatform.msg.repository.DlqMessageRepository;
import com.metaplatform.msg.repository.DlqRetryPolicyRepository;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DlqMessageServiceTest {

    @Mock
    private DlqMessageRepository dlqMessageRepository;

    @Mock
    private DlqRetryPolicyRepository dlqRetryPolicyRepository;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @InjectMocks
    private DlqMessageService dlqMessageService;

    @Test
    void list_shouldReturnPagedResults() {
        DlqMessageEntity entity = buildDlqMessage("dlq-1", "PENDING");
        Page<DlqMessageEntity> page = new PageImpl<>(List.of(entity), PageRequest.of(0, 20), 1);
        when(dlqMessageRepository.findByFilters(eq("tenant-default"), eq("test-topic"),
                eq(DlqMessageEntity.DlqStatus.PENDING), any(Pageable.class))).thenReturn(page);

        PageResponse<DlqMessageResponse> result = dlqMessageService.list(null, "test-topic", "PENDING", 1, 20);

        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getItems().get(0).getId()).isEqualTo("dlq-1");
    }

    @Test
    void getById_shouldReturnMessage_whenExists() {
        DlqMessageEntity entity = buildDlqMessage("dlq-2", "PENDING");
        when(dlqMessageRepository.findById("dlq-2")).thenReturn(Optional.of(entity));

        DlqMessageResponse response = dlqMessageService.getById("dlq-2");

        assertThat(response.getId()).isEqualTo("dlq-2");
        assertThat(response.getStatus()).isEqualTo("PENDING");
    }

    @Test
    void getById_shouldThrow_whenNotFound() {
        when(dlqMessageRepository.findById("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dlqMessageService.getById("nonexistent"))
                .isInstanceOf(MsgException.class)
                .hasMessageContaining("DLQ 消息不存在");
    }

    @Test
    void resend_shouldMarkResent_whenKafkaPublishSucceeds() {
        DlqMessageEntity message = buildDlqMessage("dlq-3", "PENDING");
        when(dlqMessageRepository.findById("dlq-3")).thenReturn(Optional.of(message));
        when(dlqRetryPolicyRepository.findByTenantIdAndTopic(any(), any())).thenReturn(Optional.empty());
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.completedFuture(null));
        when(dlqMessageRepository.save(any(DlqMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        DlqMessageResponse response = dlqMessageService.resend("dlq-3");

        assertThat(response.getStatus()).isEqualTo("RESENT");
        verify(kafkaTemplate).send(any(ProducerRecord.class));
    }

    @Test
    void resend_shouldIncrementRetry_whenKafkaPublishFails() {
        DlqMessageEntity message = buildDlqMessage("dlq-4", "PENDING");
        when(dlqMessageRepository.findById("dlq-4")).thenReturn(Optional.of(message));
        when(dlqRetryPolicyRepository.findByTenantIdAndTopic(any(), any())).thenReturn(Optional.empty());
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenThrow(new RuntimeException("Kafka unavailable"));
        when(dlqMessageRepository.save(any(DlqMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        DlqMessageResponse response = dlqMessageService.resend("dlq-4");

        assertThat(response.getStatus()).isEqualTo("PENDING");
        assertThat(response.getRetryCount()).isEqualTo(1);
        assertThat(response.getLastFailedAt()).isNotNull();
        assertThat(response.getNextRetryAt()).isNotNull();
    }

    @Test
    void resend_shouldMarkDead_whenMaxRetriesExceeded() {
        DlqMessageEntity message = buildDlqMessage("dlq-5", "PENDING");
        message.setRetryCount(3);
        when(dlqMessageRepository.findById("dlq-5")).thenReturn(Optional.of(message));
        when(dlqRetryPolicyRepository.findByTenantIdAndTopic(any(), any())).thenReturn(Optional.empty());
        when(dlqMessageRepository.save(any(DlqMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        DlqMessageResponse response = dlqMessageService.resend("dlq-5");

        assertThat(response.getStatus()).isEqualTo("DEAD");
        verify(kafkaTemplate, never()).send(any(ProducerRecord.class));
    }

    @Test
    void batchResend_shouldReturnSuccessAndFailedCounts() {
        DlqMessageEntity msg1 = buildDlqMessage("dlq-6", "PENDING");
        DlqMessageEntity msg2 = buildDlqMessage("dlq-7", "PENDING");

        when(dlqMessageRepository.findById("dlq-6")).thenReturn(Optional.of(msg1));
        when(dlqMessageRepository.findById("dlq-7")).thenReturn(Optional.of(msg2));
        when(dlqRetryPolicyRepository.findByTenantIdAndTopic(any(), any())).thenReturn(Optional.empty());
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.completedFuture(null))
                .thenThrow(new RuntimeException("Kafka unavailable"));
        when(dlqMessageRepository.save(any(DlqMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        BatchResendResponse response = dlqMessageService.batchResend(List.of("dlq-6", "dlq-7"));

        assertThat(response.getSuccessCount()).isEqualTo(1);
        assertThat(response.getFailedCount()).isEqualTo(1);
        assertThat(response.getResults()).hasSize(2);
    }

    @Test
    void resend_shouldUseRetryPolicy_whenPolicyExists() {
        DlqMessageEntity message = buildDlqMessage("dlq-8", "PENDING");
        message.setRetryCount(1);

        DlqRetryPolicyEntity policy = DlqRetryPolicyEntity.builder()
                .id("policy-1")
                .tenantId("tenant-default")
                .topic("test-topic")
                .maxRetries(2)
                .retryIntervalSeconds(30)
                .retryBackoffMultiplier(3.0)
                .autoCleanupDays(7)
                .build();

        when(dlqMessageRepository.findById("dlq-8")).thenReturn(Optional.of(message));
        when(dlqRetryPolicyRepository.findByTenantIdAndTopic("tenant-default", "test-topic"))
                .thenReturn(Optional.of(policy));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenThrow(new RuntimeException("Kafka unavailable"));
        when(dlqMessageRepository.save(any(DlqMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        DlqMessageResponse response = dlqMessageService.resend("dlq-8");

        assertThat(response.getRetryCount()).isEqualTo(2);
        assertThat(response.getStatus()).isEqualTo("DEAD");
    }

    private DlqMessageEntity buildDlqMessage(String id, String status) {
        return DlqMessageEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .originalTopic("test-topic")
                .originalMessageKey("key-" + id)
                .payload("{\"eventType\":\"TEST_EVENT\",\"data\":\"test\"}")
                .headers("{\"X-Trace-Id\":\"trace-" + id + "\"}")
                .retryCount(0)
                .status(DlqMessageEntity.DlqStatus.valueOf(status))
                .firstFailedAt(Instant.now())
                .lastFailedAt(Instant.now())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
