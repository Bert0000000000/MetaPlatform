package com.metaplatform.msg.realtime.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 广播消息请求（管理员向频道推送）。
 *
 * @param channel 目标频道：metrics / notifications / deliverables
 * @param payload 消息负载（JSON 对象）
 */
public record BroadcastRequest(
        @NotBlank(message = "频道不能为空") String channel,
        Object payload) {
}
