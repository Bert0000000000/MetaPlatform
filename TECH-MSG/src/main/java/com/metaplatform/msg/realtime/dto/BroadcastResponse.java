package com.metaplatform.msg.realtime.dto;

/**
 * 广播消息响应。
 *
 * @param channel             目标频道
 * @param sent                是否已发送
 * @param destination         WebSocket 目的地路径
 * @param estimatedRecipients 预估接收人数（当前在线连接数）
 */
public record BroadcastResponse(
        String channel,
        boolean sent,
        String destination,
        int estimatedRecipients) {
}
