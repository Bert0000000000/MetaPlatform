package com.metaplatform.action.outbox.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.outbox.entity.OutboxMessageEntity;
import com.metaplatform.action.outbox.repository.OutboxMessageRepository;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActionOutboxServiceTest {

    @Mock
    private OutboxMessageRepository outboxMessageRepository;

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ActionOutboxService actionOutboxService;

    @BeforeEach
    void setUp() {
        actionOutboxService = new ActionOutboxService(outboxMessageRepository, objectMapper, kafkaTemplate);
        ReflectionTestUtils.setField(actionOutboxService, "relayTopic", "metaplatform-action-events");
    }

    @Test
    void publish_shouldSavePendingMessage() {
        Instant before = Instant.now();
        actionOutboxService.publish("tenant-default", "exec-1", ActionEventType.ACTION_EXECUTED,
                Map.of("status", "COMPLETED"), "trace-1");

        ArgumentCaptor<OutboxMessageEntity> captor = ArgumentCaptor.forClass(OutboxMessageEntity.class);
        verify(outboxMessageRepository).save(captor.capture());
        OutboxMessageEntity saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("tenant-default");
        assertThat(saved.getAggregateId()).isEqualTo("exec-1");
        assertThat(saved.getEventType()).isEqualTo(ActionEventType.ACTION_EXECUTED);
        assertThat(saved.getStatus()).isEqualTo(OutboxMessageEntity.STATUS_PENDING);
        assertThat(saved.getRetryCount()).isZero();
        assertThat(saved.getTraceId()).isEqualTo("trace-1");
        assertThat(saved.getCreatedAt()).isAfterOrEqualTo(before);
        assertThat(saved.getPayload()).contains("COMPLETED");
    }

    @Test
    void relayOnce_shouldSendMessageAndMarkSent_whenKafkaSucceeds() {
        OutboxMessageEntity message = buildMessage(0, OutboxMessageEntity.DEFAULT_MAX_RETRIES);
        Instant now = Instant.now();
        when(outboxMessageRepository.findPendingForRelay(eq(OutboxMessageEntity.STATUS_PENDING), any(Instant.class),
                any(PageRequest.class))).thenReturn(List.of(message));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.completedFuture(null));

        int processed = actionOutboxService.relayOnce();

        assertThat(processed).isEqualTo(1);
        ArgumentCaptor<OutboxMessageEntity> captor = ArgumentCaptor.forClass(OutboxMessageEntity.class);
        verify(outboxMessageRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(OutboxMessageEntity.STATUS_SENT);
        assertThat(captor.getValue().getSentAt()).isNotNull();
    }

    @Test
    void relayOnce_shouldIncrementRetryAndKeepPending_whenKafkaFailsAndRetriesRemain() {
        OutboxMessageEntity message = buildMessage(0, OutboxMessageEntity.DEFAULT_MAX_RETRIES);
        when(outboxMessageRepository.findPendingForRelay(eq(OutboxMessageEntity.STATUS_PENDING), any(Instant.class),
                any(PageRequest.class))).thenReturn(List.of(message));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenThrow(new RuntimeException("kafka broker unavailable"));

        actionOutboxService.relayOnce();

        ArgumentCaptor<OutboxMessageEntity> captor = ArgumentCaptor.forClass(OutboxMessageEntity.class);
        verify(outboxMessageRepository).save(captor.capture());
        OutboxMessageEntity saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(OutboxMessageEntity.STATUS_PENDING);
        assertThat(saved.getRetryCount()).isEqualTo(1);
        assertThat(saved.getNextRetryAt()).isAfter(Instant.now());
        assertThat(saved.getErrorMessage()).contains("kafka broker unavailable");
    }

    @Test
    void relayOnce_shouldMoveToFailedDlq_whenMaxRetriesExceeded() {
        OutboxMessageEntity message = buildMessage(OutboxMessageEntity.DEFAULT_MAX_RETRIES - 1,
                OutboxMessageEntity.DEFAULT_MAX_RETRIES);
        when(outboxMessageRepository.findPendingForRelay(eq(OutboxMessageEntity.STATUS_PENDING), any(Instant.class),
                any(PageRequest.class))).thenReturn(List.of(message));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenThrow(new RuntimeException("kafka broker unavailable"));

        actionOutboxService.relayOnce();

        ArgumentCaptor<OutboxMessageEntity> captor = ArgumentCaptor.forClass(OutboxMessageEntity.class);
        verify(outboxMessageRepository).save(captor.capture());
        OutboxMessageEntity saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(OutboxMessageEntity.STATUS_FAILED);
        assertThat(saved.getRetryCount()).isEqualTo(OutboxMessageEntity.DEFAULT_MAX_RETRIES);
    }

    @Test
    void publish_shouldSaveStringPayloadAsIs() {
        actionOutboxService.publish("tenant-default", "exec-1", ActionEventType.ACTION_EXECUTED,
                "{\"raw\":\"payload\"}", "trace-1");

        ArgumentCaptor<OutboxMessageEntity> captor = ArgumentCaptor.forClass(OutboxMessageEntity.class);
        verify(outboxMessageRepository).save(captor.capture());
        assertThat(captor.getValue().getPayload()).isEqualTo("{\"raw\":\"payload\"}");
    }

    private OutboxMessageEntity buildMessage(int retryCount, int maxRetries) {
        Instant now = Instant.now();
        return OutboxMessageEntity.builder()
                .tenantId("tenant-default")
                .aggregateId("exec-1")
                .eventType(ActionEventType.ACTION_EXECUTED)
                .payload("{\"status\":\"COMPLETED\"}")
                .status(OutboxMessageEntity.STATUS_PENDING)
                .retryCount(retryCount)
                .maxRetries(maxRetries)
                .nextRetryAt(now.minusSeconds(1))
                .traceId("trace-1")
                .createdAt(now)
                .build();
    }
}
