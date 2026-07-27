package com.metaplatform.msg.realtime;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 连接管理器（P0-5）。
 *
 * <p>跟踪在线 STOMP 连接（SessionId → UserId 映射），通过事件监听器维护连接状态。</p>
 * <ul>
 *   <li>{@link SessionConnectEvent} — 客户端 CONNECT 时注册会话</li>
 *   <li>{@link SessionDisconnectEvent} — 客户端断开时清理会话</li>
 * </ul>
 *
 * <p>用户标识从 STOMP CONNECT 帧的 {@code login} 头读取，租户标识从 {@code tenant-id} 头读取。</p>
 */
@Slf4j
@Component
public class WebSocketConnectionManager {

    /** SessionId → 连接信息 */
    private final ConcurrentHashMap<String, ConnectionRecord> sessions = new ConcurrentHashMap<>();

    /** UserId → SessionId 集合（同一用户可多端连接） */
    private final ConcurrentHashMap<String, Set<String>> userSessions = new ConcurrentHashMap<>();

    @EventListener
    public void onSessionConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String userId = accessor.getLogin();
        if (userId == null || userId.isBlank()) {
            userId = accessor.getFirstNativeHeader("user-id");
        }
        if (userId == null || userId.isBlank()) {
            log.warn("WebSocket 连接缺少用户标识 | session={}", sessionId);
            return;
        }
        String tenantId = accessor.getFirstNativeHeader("tenant-id");

        ConnectionRecord record = new ConnectionRecord(sessionId, userId, tenantId, Instant.now());
        sessions.put(sessionId, record);
        userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        log.info("WebSocket 连接建立 | session={} user={} tenant={}", sessionId, userId, tenantId);
    }

    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        ConnectionRecord record = sessions.remove(sessionId);
        if (record == null) {
            return;
        }
        Set<String> sessionsForUser = userSessions.get(record.userId());
        if (sessionsForUser != null) {
            sessionsForUser.remove(sessionId);
            if (sessionsForUser.isEmpty()) {
                userSessions.remove(record.userId());
            }
        }
        log.info("WebSocket 连接断开 | session={} user={}", sessionId, record.userId());
    }

    /**
     * 获取当前在线连接总数。
     */
    public int getConnectionCount() {
        return sessions.size();
    }

    /**
     * 获取在线用户数。
     */
    public int getOnlineUserCount() {
        return userSessions.size();
    }

    /**
     * 获取指定用户的连接信息。
     *
     * @param userId 用户 ID
     * @return 连接信息响应，若用户不在线返回 online=false
     */
    public UserConnectionInfo getConnectionInfo(String userId) {
        Set<String> sessionIds = userSessions.get(userId);
        if (sessionIds == null || sessionIds.isEmpty()) {
            return new UserConnectionInfo(userId, false, 0, Collections.emptyList());
        }
        List<SessionSummary> summaries = sessionIds.stream()
                .map(sessions::get)
                .filter(java.util.Objects::nonNull)
                .map(r -> new SessionSummary(r.sessionId(), r.tenantId(), r.connectedAt()))
                .toList();
        return new UserConnectionInfo(userId, true, summaries.size(), summaries);
    }

    /**
     * 判断用户是否在线。
     */
    public boolean isUserOnline(String userId) {
        Set<String> sessionIds = userSessions.get(userId);
        return sessionIds != null && !sessionIds.isEmpty();
    }

    /**
     * 获取指定用户的会话数。
     */
    public int getSessionCount(String userId) {
        Set<String> sessionIds = userSessions.get(userId);
        return sessionIds != null ? sessionIds.size() : 0;
    }

    /**
     * 内部连接记录。
     */
    private record ConnectionRecord(String sessionId, String userId, String tenantId, Instant connectedAt) {
    }

    /**
     * 用户连接信息（内部传输）。
     */
    public record UserConnectionInfo(String userId, boolean online, int sessionCount,
                                      List<SessionSummary> sessions) {
    }

    /**
     * 会话摘要（内部传输）。
     */
    public record SessionSummary(String sessionId, String tenantId, Instant connectedAt) {
    }
}
