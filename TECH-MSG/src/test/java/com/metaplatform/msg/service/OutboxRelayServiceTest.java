package com.metaplatform.msg.service;

import com.metaplatform.msg.entity.OutboxMessageEntity;
import com.metaplatform.msg.repository.OutboxMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxRelayServiceTest {

    @Mock
    private OutboxMessageRepository outboxRepository;

    @Mock
    private KafkaPublisherService kafkaPublisherService;

    @InjectMocks
    private OutboxRelayService outboxRelayService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(outboxRelayService, "batchSize", 100);
        ReflectionTestUtils.setField(outboxRelayService, "maxRetries", 3);
        ReflectionTestUtils.setField(outboxRelayService, "backoffInitialMs", 1000L);
        ReflectionTestUtils.setField(outboxRelayService, "backoffMaxMs", 60000L);
        ReflectionTestUtils.setField(outboxRelayService, "backoffMultiplier", 2.0);
    }

    @Test
    void relay_shouldMarkSent_whenKafkaPublishSucceeds() {
        OutboxMessageEntity message = buildOutboxMessage("msg-1", "User", "user-1", "USER_REGISTERED", 0);
        when(outboxRepository.findPendingForRelay(eq(OutboxMessageEntity.OutboxStatus.PENDING), any(Instant.class), any()))
                .thenReturn(List.of(message));
        when(outboxRepository.save(any(OutboxMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        outboxRelayService.relayMessages();

        verify(kafkaPublisherService).publish(eq("metaplatform.User.USER_REGISTERED"), eq("user-1"), anyMap(), anyMap());
        assertThat(message.getStatus()).isEqualTo(OutboxMessageEntity.OutboxStatus.SENT);
        assertThat(message.getSentAt()).isNotNull();
    }

    @Test
    void relay_shouldIncrementRetry_whenKafkaPublishFails() {
        OutboxMessageEntity message = buildOutboxMessage("msg-2", "User", "user-2", "USER_LOGIN", 0);
        when(outboxRepository.findPendingForRelay(eq(OutboxMessageEntity.OutboxStatus.PENDING), any(Instant.class), any()))
                .thenReturn(List.of(message));
        doThrow(new RuntimeException("Kafka unavailable"))
                .when(kafkaPublisherService).publish(anyString(), anyString(), anyMap(), anyMap());
        when(outboxRepository.save(any(OutboxMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        outboxRelayService.relayMessages();

        assertThat(message.getStatus()).isEqualTo(OutboxMessageEntity.OutboxStatus.PENDING);
        assertThat(message.getRetryCount()).isEqualTo(1);
        assertThat(message.getNextRetryAt()).isNotNull();
    }

    @Test
    void relay_shouldSendToDlq_whenRetryExceedsMaxRetries() {
        OutboxMessageEntity message = buildOutboxMessage("msg-3", "Rule", "rule-1", "RULE_CREATED", 2);
        message.setMaxRetries(3);
        when(outboxRepository.findPendingForRelay(eq(OutboxMessageEntity.OutboxStatus.PENDING), any(Instant.class), any()))
                .thenReturn(List.of(message));
        doThrow(new RuntimeException("Kafka unavailable"))
                .when(kafkaPublisherService).publish(anyString(), anyString(), anyMap(), anyMap());
        when(outboxRepository.save(any(OutboxMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        outboxRelayService.relayMessages();

        assertThat(message.getStatus()).isEqualTo(OutboxMessageEntity.OutboxStatus.FAILED);
        assertThat(message.getRetryCount()).isEqualTo(3);
        verify(kafkaPublisherService).publishToDlq(eq("metaplatform.Rule.RULE_CREATED"), eq("rule-1"), anyMap(), anyMap());
    }

    @Test
    void manualRetry_shouldResetToPending_whenMessageExistsAndNotSent() {
        OutboxMessageEntity message = buildOutboxMessage("msg-4", "User", "user-4", "USER_REGISTERED", 3);
        message.setStatus(OutboxMessageEntity.OutboxStatus.FAILED);
        when(outboxRepository.findById("msg-4")).thenReturn(Optional.of(message));
        when(outboxRepository.save(any(OutboxMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        boolean result = outboxRelayService.manualRetry("msg-4");

        assertThat(result).isTrue();
        assertThat(message.getStatus()).isEqualTo(OutboxMessageEntity.OutboxStatus.PENDING);
        assertThat(message.getRetryCount()).isEqualTo(0);
    }

    @Test
    void relay_shouldDoNothing_whenNoPendingMessages() {
        when(outboxRepository.findPendingForRelay(eq(OutboxMessageEntity.OutboxStatus.PENDING), any(Instant.class), any()))
                .thenReturn(List.of());

        outboxRelayService.relayMessages();

        verify(kafkaPublisherService, never()).publish(anyString(), anyString(), anyMap(), anyMap());
        verify(outboxRepository, never()).save(any(OutboxMessageEntity.class));
    }

    @Test
    void relay_shouldBuildCorrectTopicName() {
        OutboxMessageEntity message = buildOutboxMessage("msg-5", "Task", "task-1", "TASK_COMPLETED", 0);
        when(outboxRepository.findPendingForRelay(eq(OutboxMessageEntity.OutboxStatus.PENDING), any(Instant.class), any()))
                .thenReturn(List.of(message));
        when(outboxRepository.save(any(OutboxMessageEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        outboxRelayService.relayMessages();

        verify(kafkaPublisherService).publish(eq("metaplatform.Task.TASK_COMPLETED"), eq("task-1"), anyMap(), anyMap());
    }

    private OutboxMessageEntity buildOutboxMessage(String id, String aggregateType, String aggregateId,
                                                    String eventType, int retryCount) {
        Map<String, Object> headers = new HashMap<>();
        headers.put("X-Trace-Id", "trace-" + id);
        headers.put("X-Tenant-Id", "tenant-default");

        Map<String, Object> payload = new HashMap<>();
        payload.put("aggregateId", aggregateId);
        payload.put("eventType", eventType);

        return OutboxMessageEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .eventType(eventType)
                .payload(payload)
                .headers(headers)
                .status(OutboxMessageEntity.OutboxStatus.PENDING)
                .retryCount(retryCount)
                .maxRetries(3)
                .createdAt(Instant.now())
                .build();
    }
}
