package com.metaplatform.mcp.alert.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.config.McpAlertProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 告警事件投递：
 *  - 优先通过 KafkaTemplate 投递到 mcp-alert-events topic（TECH-OBS 消费后推送通知渠道）
 *  - 若配置了 mate.mcp.alert.msg-base-url → 同时通过 Spring WebClient 调 TECH-MSG（可选）
 *  - KafkaTemplate 不可用时退化到 ApplicationEventPublisher（仅日志）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertNotificationSender {

    private final ObjectProvider<KafkaTemplate<String, String>> kafkaTemplateProvider;
    private final ApplicationEventPublisher eventPublisher;
    private final McpAlertProperties alertProperties;
    private final ObjectMapper objectMapper;

    public void send(Map<String, Object> alertPayload) {
        String json = serialize(alertPayload);
        KafkaTemplate<String, String> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate != null) {
            try {
                String tenantId = String.valueOf(alertPayload.getOrDefault("tenantId", "tenant-default"));
                kafkaTemplate.send(alertProperties.getAlertTopic(), tenantId, json);
                log.debug("Alert dispatched to Kafka topic={}, tenantId={}",
                        alertProperties.getAlertTopic(), tenantId);
                return;
            } catch (Exception e) {
                log.warn("Alert Kafka dispatch failed: {}", e.getMessage());
            }
        }
        eventPublisher.publishEvent(new AlertFiredEvent(alertPayload));
        log.info("Alert fired: {}", alertPayload);
    }

    private String serialize(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}