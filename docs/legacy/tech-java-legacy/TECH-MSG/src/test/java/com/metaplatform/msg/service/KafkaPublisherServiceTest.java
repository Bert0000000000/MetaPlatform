package com.metaplatform.msg.service;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KafkaPublisherServiceTest {

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @InjectMocks
    private KafkaPublisherService kafkaPublisherService;

    @Test
    void publish_shouldSendKafkaMessageWithTraceIdHeader() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("eventType", "USER_REGISTERED");
        payload.put("userId", "user-1");

        Map<String, Object> headers = new HashMap<>();
        headers.put("X-Trace-Id", "trace-abc-123");
        headers.put("X-Tenant-Id", "tenant-default");

        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.completedFuture(null));

        kafkaPublisherService.publish("metaplatform.User.USER_REGISTERED", "user-1", payload, headers);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<ProducerRecord<String, Object>> captor = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafkaTemplate).send(captor.capture());

        ProducerRecord<String, Object> record = captor.getValue();
        assertThat(record.topic()).isEqualTo("metaplatform.User.USER_REGISTERED");
        assertThat(record.key()).isEqualTo("user-1");

        String traceId = getHeaderValue(record, "X-Trace-Id");
        String tenantId = getHeaderValue(record, "X-Tenant-Id");
        assertThat(traceId).isEqualTo("trace-abc-123");
        assertThat(tenantId).isEqualTo("tenant-default");
    }

    @Test
    void publishToDlq_shouldIncludeOriginalTopicHeader() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("eventType", "RULE_CREATED");

        Map<String, Object> headers = new HashMap<>();
        headers.put("X-Trace-Id", "trace-dlq-456");

        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.completedFuture(null));

        kafkaPublisherService.publishToDlq("metaplatform.Rule.RULE_CREATED", "rule-1", payload, headers);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<ProducerRecord<String, Object>> captor = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafkaTemplate).send(captor.capture());

        ProducerRecord<String, Object> record = captor.getValue();
        assertThat(record.topic()).isEqualTo("metaplatform.dlq");

        String traceId = getHeaderValue(record, "X-Trace-Id");
        String originalTopic = getHeaderValue(record, "X-Original-Topic");
        assertThat(traceId).isEqualTo("trace-dlq-456");
        assertThat(originalTopic).isEqualTo("metaplatform.Rule.RULE_CREATED");
    }

    private String getHeaderValue(ProducerRecord<String, Object> record, String key) {
        for (Header header : record.headers()) {
            if (header.key().equals(key)) {
                return new String(header.value(), StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
