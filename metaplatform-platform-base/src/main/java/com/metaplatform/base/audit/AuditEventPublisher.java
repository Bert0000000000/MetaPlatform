package com.metaplatform.base.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AuditEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(AuditEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;

    public AuditEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                               @Value("${platform.audit.topic:platform.audit.events}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    /**
     * 发布审计事件到 Kafka（异步，fire-and-forget）
     */
    public void publish(AuditLog auditLog) {
        Map<String, Object> event = Map.of(
                "auditId", auditLog.getId() != null ? auditLog.getId() : 0,
                "tenantId", auditLog.getTenantId().toString(),
                "userId", auditLog.getUserId().toString(),
                "action", auditLog.getAction(),
                "resourceType", auditLog.getResourceType(),
                "resourceId", auditLog.getResourceId(),
                "timestamp", auditLog.getTimestamp().toString(),
                "details", auditLog.getDetails() != null ? auditLog.getDetails() : "{}"
        );

        kafkaTemplate.send(topic, auditLog.getTenantId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish audit event to Kafka: {}", ex.getMessage(), ex);
                    } else {
                        log.debug("Audit event published to topic={}, partition={}, offset={}",
                                result.getRecordMetadata().topic(),
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }
}
