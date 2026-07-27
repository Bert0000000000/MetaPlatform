package com.metaplatform.action.trigger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.common.TraceContext;
import com.metaplatform.action.trigger.entity.ActionTriggerEntity;
import com.metaplatform.action.trigger.repository.ActionTriggerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.listener.ConcurrentMessageListenerContainer;
import org.springframework.kafka.listener.MessageListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * EVENT 触发器的 Kafka 消费者。
 *
 * <p>启动时查询所有启用的 TYPE_EVENT 触发器，按 eventTopic 分组，为每个 topic
 * 创建独立的 {@link ConcurrentMessageListenerContainer}。收到消息后从 Kafka 消息头
 * 提取 tenantId/traceId 设置到 {@link TenantContext}/{@link TraceContext}，
 * 再委托 {@link ActionTriggerService#fireByEventTopic} 执行。</p>
 *
 * <p>通过 {@code @Scheduled} 定期刷新 topic 订阅，支持运行时新增/删除触发器。
 * 可通过 {@code app.trigger.event.enabled=false} 关闭。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventTriggerConsumer implements org.springframework.context.SmartLifecycle {

    private static final long REFRESH_INTERVAL_MS = 60_000;

    private final ConcurrentKafkaListenerContainerFactory<String, String> containerFactory;
    private final ActionTriggerRepository actionTriggerRepository;
    private final ActionTriggerService actionTriggerService;
    private final ObjectMapper objectMapper;

    @Value("${app.trigger.event.enabled:true}")
    private boolean eventTriggerEnabled;

    private final Map<String, ConcurrentMessageListenerContainer<String, String>> containers = new ConcurrentHashMap<>();
    private volatile boolean running = false;

    @Override
    public synchronized void start() {
        this.running = true;
        if (!eventTriggerEnabled) {
            log.info("Event trigger consumer disabled (app.trigger.event.enabled=false)");
            return;
        }
        log.info("Event trigger consumer starting...");
        refreshSubscriptions();
    }

    @Override
    public synchronized void stop() {
        log.info("Event trigger consumer stopping...");
        this.running = false;
        containers.forEach((topic, container) -> {
            try {
                container.stop();
            } catch (Exception e) {
                log.warn("Failed to stop container for topic {}", topic, e);
            }
        });
        containers.clear();
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    /**
     * 定期刷新 event topic 订阅：新增 topic 启动容器，移除 topic 停止容器。
     */
    @Scheduled(fixedRate = REFRESH_INTERVAL_MS)
    public synchronized void refreshSubscriptions() {
        if (!running || !eventTriggerEnabled) {
            return;
        }
        try {
            Set<String> desiredTopics = findAllEventTopics();
            Set<String> currentTopics = containers.keySet();

            // 新增 topic
            for (String topic : desiredTopics) {
                if (!currentTopics.contains(topic)) {
                    createAndStartContainer(topic);
                }
            }

            // 移除不再需要的 topic
            for (String topic : currentTopics) {
                if (!desiredTopics.contains(topic)) {
                    stopAndRemoveContainer(topic);
                }
            }
        } catch (Exception e) {
            log.error("Failed to refresh event trigger subscriptions", e);
        }
    }

    /**
     * 查询所有启用的 EVENT 触发器（跨租户）并收集去重后的 eventTopic 集合。
     */
    private Set<String> findAllEventTopics() {
        List<ActionTriggerEntity> triggers = actionTriggerRepository
                .findAllByTriggerTypeAndEnabledAndDeletedAtIsNull(
                        ActionTriggerEntity.TYPE_EVENT, Boolean.TRUE);
        return triggers.stream()
                .map(ActionTriggerEntity::getEventTopic)
                .filter(t -> t != null && !t.isBlank())
                .collect(Collectors.toSet());
    }

    private void createAndStartContainer(String topic) {
        try {
            ConcurrentMessageListenerContainer<String, String> container = containerFactory.createContainer(topic);
            container.getContainerProperties().setMessageListener(new EventMessageListener(topic));
            container.start();
            containers.put(topic, container);
            log.info("Started Kafka container for event topic: {}", topic);
        } catch (Exception e) {
            log.error("Failed to create/start Kafka container for topic {}", topic, e);
        }
    }

    private void stopAndRemoveContainer(String topic) {
        ConcurrentMessageListenerContainer<String, String> container = containers.remove(topic);
        if (container != null) {
            try {
                container.stop();
                log.info("Stopped Kafka container for event topic: {}", topic);
            } catch (Exception e) {
                log.warn("Failed to stop container for topic {}", topic, e);
            }
        }
    }

    /**
     * 单个 topic 的消息监听器。每条消息处理时从 header 提取 tenantId/traceId，
     * 设置到 ThreadLocal 后委托 {@link ActionTriggerService#fireByEventTopic}。
     */
    private class EventMessageListener implements MessageListener<String, String> {

        private final String topic;

        EventMessageListener(String topic) {
            this.topic = topic;
        }

        @Override
        public void onMessage(ConsumerRecord<String, String> record) {
            try {
                String tenantId = extractHeader(record, TenantContext.TENANT_ID_HEADER);
                String traceId = extractHeader(record, TraceContext.TRACE_ID_HEADER);

                if (tenantId != null && !tenantId.isBlank()) {
                    TenantContext.set(tenantId);
                }
                if (traceId != null && !traceId.isBlank()) {
                    TraceContext.set(traceId);
                }

                Object eventData = parseEventData(record.value());
                log.debug("Event trigger message received: topic={}, partition={}, offset={}, tenantId={}",
                        topic, record.partition(), record.offset(), tenantId);

                actionTriggerService.fireByEventTopic(topic, eventData);
            } catch (Exception e) {
                log.error("Failed to process event message on topic {}", topic, e);
            } finally {
                TenantContext.clear();
                TraceContext.clear();
            }
        }

        private String extractHeader(ConsumerRecord<String, String> record, String key) {
            Header header = record.headers().lastHeader(key);
            return header != null ? new String(header.value(), StandardCharsets.UTF_8) : null;
        }

        private Object parseEventData(String value) {
            if (value == null || value.isBlank()) {
                return null;
            }
            try {
                return objectMapper.readValue(value, Object.class);
            } catch (Exception e) {
                log.debug("Failed to parse event data as JSON, using raw string: {}", e.getMessage());
                return value;
            }
        }
    }
}
