package com.metaplatform.msg.service;

import com.metaplatform.msg.common.TraceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaPublisherService {

    private static final String HEADER_TRACE_ID = "X-Trace-Id";
    private static final String HEADER_TENANT_ID = "X-Tenant-Id";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publish(String topic, String key, Map<String, Object> payload, Map<String, Object> headers) {
        ProducerRecord<String, Object> record = new ProducerRecord<>(topic, null, key, payload, buildHeaders(topic, key, headers));
        kafkaTemplate.send(record);
        log.info("Kafka message published to topic={}, key={}, traceId={}", topic, key, extractTraceId(headers));
    }

    public void publishToDlq(String originalTopic, String key, Map<String, Object> payload, Map<String, Object> headers) {
        String dlqTopic = "metaplatform.dlq";
        java.util.List<Header> headerList = buildHeaders(dlqTopic, key, headers);
        headerList.add(new RecordHeader("X-Original-Topic", originalTopic.getBytes(StandardCharsets.UTF_8)));
        ProducerRecord<String, Object> record = new ProducerRecord<>(dlqTopic, null, key, payload, headerList);
        kafkaTemplate.send(record);
        log.warn("Kafka DLQ message published to dlqTopic={}, originalTopic={}, traceId={}", dlqTopic, originalTopic, extractTraceId(headers));
    }

    private java.util.List<Header> buildHeaders(String topic, String key, Map<String, Object> headers) {
        java.util.List<Header> headerList = new java.util.ArrayList<>();
        String traceId = extractTraceId(headers);
        headerList.add(new RecordHeader(HEADER_TRACE_ID, traceId.getBytes(StandardCharsets.UTF_8)));
        String tenantId = extractTenantId(headers);
        if (tenantId != null) {
            headerList.add(new RecordHeader(HEADER_TENANT_ID, tenantId.getBytes(StandardCharsets.UTF_8)));
        }
        if (headers != null) {
            for (Map.Entry<String, Object> entry : headers.entrySet()) {
                if (!HEADER_TRACE_ID.equals(entry.getKey()) && !HEADER_TENANT_ID.equals(entry.getKey())
                        && !"traceId".equals(entry.getKey()) && !"tenantId".equals(entry.getKey())) {
                    headerList.add(new RecordHeader(entry.getKey(), String.valueOf(entry.getValue()).getBytes(StandardCharsets.UTF_8)));
                }
            }
        }
        return headerList;
    }

    private String extractTraceId(Map<String, Object> headers) {
        if (headers != null) {
            Object traceId = headers.get(HEADER_TRACE_ID);
            if (traceId != null && !traceId.toString().isBlank()) {
                return traceId.toString();
            }
            Object lowerTraceId = headers.get("traceId");
            if (lowerTraceId != null && !lowerTraceId.toString().isBlank()) {
                return lowerTraceId.toString();
            }
        }
        return TraceContext.getOrCreate();
    }

    private String extractTenantId(Map<String, Object> headers) {
        if (headers != null) {
            Object tenantId = headers.get(HEADER_TENANT_ID);
            if (tenantId != null) {
                return tenantId.toString();
            }
            Object lowerTenantId = headers.get("tenantId");
            if (lowerTenantId != null) {
                return lowerTenantId.toString();
            }
        }
        return null;
    }
}
