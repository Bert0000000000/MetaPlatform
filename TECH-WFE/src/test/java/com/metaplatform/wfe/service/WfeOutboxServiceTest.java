package com.metaplatform.wfe.service;

import com.metaplatform.wfe.entity.WfeOutboxMessageEntity;
import com.metaplatform.wfe.repository.WfeOutboxMessageRepository;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * P1-WFE-09: Kafka Outbox 服务测试（mock KafkaTemplate + mock Repository）。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WfeOutboxServiceTest {

    @Mock
    private WfeOutboxMessageRepository outboxRepository;

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    @InjectMocks
    private WfeOutboxService wfeOutboxService;

    @Test
    void publishEvent_shouldSaveOutboxMessage() {
        when(outboxRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        wfeOutboxService.publishEvent("tenant-1", "task-1", "TASK_COMPLETED",
                Map.of("taskId", "task-1"), Map.of("X-Trace-Id", "trace-1"));

        verify(outboxRepository).save(any(WfeOutboxMessageEntity.class));
    }

    @Test
    void relay_shouldSendPendingMessageAndMarkSent() {
        WfeOutboxMessageEntity msg = WfeOutboxMessageEntity.builder()
                .id("msg-1").tenantId("tenant-1").aggregateType("Task")
                .aggregateId("task-1").eventType("TASK_COMPLETED")
                .payload("{\"taskId\":\"task-1\"}")
                .headers("{\"X-Trace-Id\":\"trace-1\"}")
                .status("PENDING").retryCount(0).maxRetries(3).build();

        when(outboxRepository.findTop50ByStatusOrderByCreatedAtAsc("PENDING"))
                .thenReturn(List.of(msg));
        when(outboxRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.<SendResult<String, String>>completedFuture(null));

        wfeOutboxService.relay();

        assertThat(msg.getStatus()).isEqualTo("SENT");
        assertThat(msg.getSentAt()).isNotNull();
        verify(kafkaTemplate).send(any(ProducerRecord.class));
    }

    @Test
    void relay_shouldIncrementRetryOnFailure() {
        WfeOutboxMessageEntity msg = WfeOutboxMessageEntity.builder()
                .id("msg-2").tenantId("tenant-1").aggregateType("Task")
                .aggregateId("task-2").eventType("TASK_REJECTED")
                .payload("{}").headers(null)
                .status("PENDING").retryCount(0).maxRetries(3).build();

        when(outboxRepository.findTop50ByStatusOrderByCreatedAtAsc("PENDING"))
                .thenReturn(List.of(msg));
        when(outboxRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.<SendResult<String, String>>failedFuture(
                        new RuntimeException("kafka down")));

        wfeOutboxService.relay();

        assertThat(msg.getStatus()).isEqualTo("PENDING");
        assertThat(msg.getRetryCount()).isEqualTo(1);
        assertThat(msg.getNextRetryAt()).isNotNull();
    }

    @Test
    void relay_shouldMarkDeadWhenMaxRetriesExceeded() {
        WfeOutboxMessageEntity msg = WfeOutboxMessageEntity.builder()
                .id("msg-3").tenantId("tenant-1").aggregateType("Task")
                .aggregateId("task-3").eventType("TASK_TRANSFERRED")
                .payload("{}").headers(null)
                .status("PENDING").retryCount(2).maxRetries(3).build();

        when(outboxRepository.findTop50ByStatusOrderByCreatedAtAsc("PENDING"))
                .thenReturn(List.of(msg));
        when(outboxRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.<SendResult<String, String>>failedFuture(
                        new RuntimeException("kafka down")));

        wfeOutboxService.relay();

        assertThat(msg.getStatus()).isEqualTo("DEAD");
        assertThat(msg.getRetryCount()).isEqualTo(3);
    }

    @Test
    void relay_shouldDoNothing_whenNoPendingMessages() {
        when(outboxRepository.findTop50ByStatusOrderByCreatedAtAsc("PENDING"))
                .thenReturn(List.of());

        wfeOutboxService.relay();

        verify(kafkaTemplate, never()).send(any(ProducerRecord.class));
    }
}
