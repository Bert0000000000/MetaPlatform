package com.metaplatform.msg.realtime;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket STOMP 配置（P0-5）。
 *
 * <p>端点：{@code /ws}（SockJS 兼容）</p>
 * <p>Broker：{@code /topic}（广播频道）、{@code /queue}（用户队列）</p>
 * <p>应用前缀：{@code /app}，用户前缀：{@code /user}</p>
 *
 * <p>推流频道：</p>
 * <ul>
 *   <li>{@code /topic/dashboard/metrics} — 指标实时推送</li>
 *   <li>{@code /topic/dashboard/notifications} — 通知实时推送</li>
 *   <li>{@code /topic/dashboard/deliverables} — 新材料推送</li>
 * </ul>
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }
}
