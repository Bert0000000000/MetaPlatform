package com.metaplatform.msg.realtime.dto;

import java.time.Instant;
import java.util.List;

/**
 * 指定用户的 WebSocket 连接状态响应。
 *
 * @param userId       用户 ID
 * @param online       是否在线
 * @param sessionCount 会话数（同一用户可多端连接）
 * @param sessions     会话详情列表
 */
public record ConnectionInfoResponse(
        String userId,
        boolean online,
        int sessionCount,
        List<SessionDetail> sessions) {

    /**
     * 单个 WebSocket 会话详情。
     *
     * @param sessionId   STOMP 会话 ID
     * @param tenantId    租户 ID（可能为空）
     * @param connectedAt 连接建立时间
     */
    public record SessionDetail(
            String sessionId,
            String tenantId,
            Instant connectedAt) {
    }
}
