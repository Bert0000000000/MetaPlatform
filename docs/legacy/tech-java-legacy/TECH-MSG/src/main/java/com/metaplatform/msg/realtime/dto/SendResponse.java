package com.metaplatform.msg.realtime.dto;

/**
 * 向指定用户推送消息响应。
 *
 * @param userId       目标用户 ID
 * @param destination  用户队列目的地
 * @param sent         是否已发送
 * @param sessionCount 用户当前会话数
 */
public record SendResponse(
        String userId,
        String destination,
        boolean sent,
        int sessionCount) {
}
