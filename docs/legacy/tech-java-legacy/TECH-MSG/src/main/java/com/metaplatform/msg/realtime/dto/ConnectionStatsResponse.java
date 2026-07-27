package com.metaplatform.msg.realtime.dto;

import java.util.List;

/**
 * WebSocket 连接统计响应。
 *
 * @param totalConnections 当前在线连接总数
 * @param onlineUsers       在线用户数
 * @param channels          可用推送频道列表
 */
public record ConnectionStatsResponse(
        int totalConnections,
        int onlineUsers,
        List<String> channels) {
}
