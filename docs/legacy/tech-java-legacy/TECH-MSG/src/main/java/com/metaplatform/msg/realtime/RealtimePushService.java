package com.metaplatform.msg.realtime;

import com.metaplatform.msg.common.ErrorCode;
import com.metaplatform.msg.common.MsgException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;

/**
 * 实时推流服务（P0-5）。
 *
 * <p>监听 Kafka 三个主题，将消息推送到对应 WebSocket 频道：</p>
 * <ul>
 *   <li>{@code metaplatform.dashboard.metrics} → {@code /topic/dashboard/metrics}</li>
 *   <li>{@code metaplatform.dashboard.notifications} → {@code /topic/dashboard/notifications}</li>
 *   <li>{@code metaplatform.dashboard.deliverables} → {@code /topic/dashboard/deliverables}</li>
 * </ul>
 *
 * <p>同时提供广播与定向用户推送能力，供 {@link RealtimePushController} 调用。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RealtimePushService {

    /** 频道 → WebSocket 目的地映射 */
    static final Map<String, String> CHANNEL_DESTINATIONS = Map.of(
            "metrics", "/topic/dashboard/metrics",
            "notifications", "/topic/dashboard/notifications",
            "deliverables", "/topic/dashboard/deliverables");

    private static final Set<String> VALID_CHANNELS = CHANNEL_DESTINATIONS.keySet();

    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketConnectionManager connectionManager;

    // =====================================================================
    // Kafka 监听 → WebSocket 推送
    // =====================================================================

    @KafkaListener(
            topics = "${app.msg.realtime.topics.metrics:metaplatform.dashboard.metrics}",
            groupId = "${spring.kafka.consumer.group-id:tech-msg}")
    public void onMetricsMessage(ConsumerRecord<String, String> record) {
        forwardToWebSocket("metrics", record.key(), record.value());
    }

    @KafkaListener(
            topics = "${app.msg.realtime.topics.notifications:metaplatform.dashboard.notifications}",
            groupId = "${spring.kafka.consumer.group-id:tech-msg}")
    public void onNotificationsMessage(ConsumerRecord<String, String> record) {
        forwardToWebSocket("notifications", record.key(), record.value());
    }

    @KafkaListener(
            topics = "${app.msg.realtime.topics.deliverables:metaplatform.dashboard.deliverables}",
            groupId = "${spring.kafka.consumer.group-id:tech-msg}")
    public void onDeliverablesMessage(ConsumerRecord<String, String> record) {
        forwardToWebSocket("deliverables", record.key(), record.value());
    }

    private void forwardToWebSocket(String channel, String key, String payload) {
        String destination = CHANNEL_DESTINATIONS.get(channel);
        try {
            messagingTemplate.convertAndSend(destination, payload);
            log.info("WebSocket 推送 | channel={} destination={} key={}", channel, destination, key);
        } catch (Exception e) {
            log.error("WebSocket 推送失败 | channel={} destination={} key={} error={}",
                    channel, destination, key, e.getMessage());
        }
    }

    // =====================================================================
    // 广播与定向推送
    // =====================================================================

    /**
     * 向指定频道广播消息。
     *
     * @param channel 目标频道（metrics / notifications / deliverables）
     * @param payload 消息负载
     * @return WebSocket 目的地路径
     */
    public String broadcast(String channel, Object payload) {
        String destination = CHANNEL_DESTINATIONS.get(channel);
        if (destination == null) {
            throw new MsgException(ErrorCode.INVALID_CHANNEL, "非法推送频道: " + channel);
        }
        messagingTemplate.convertAndSend(destination, payload);
        log.info("WebSocket 广播 | channel={} destination={} recipients={}",
                channel, destination, connectionManager.getConnectionCount());
        return destination;
    }

    /**
     * 向指定用户推送消息（通过用户队列）。
     *
     * @param userId      目标用户 ID
     * @param destination 用户队列目的地（如 /queue/notifications）
     * @param payload     消息负载
     * @return 用户当前会话数
     */
    public int sendToUser(String userId, String destination, Object payload) {
        if (!connectionManager.isUserOnline(userId)) {
            throw new MsgException(ErrorCode.WEBSOCKET_USER_NOT_CONNECTED,
                    "用户未连接 WebSocket: " + userId);
        }
        messagingTemplate.convertAndSendToUser(userId, destination, payload);
        int sessionCount = connectionManager.getSessionCount(userId);
        log.info("WebSocket 定向推送 | user={} destination={} sessions={}",
                userId, destination, sessionCount);
        return sessionCount;
    }

    /**
     * 获取可用频道列表。
     */
    Set<String> getValidChannels() {
        return VALID_CHANNELS;
    }
}
