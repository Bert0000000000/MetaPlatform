package com.metaplatform.msg.realtime.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 向指定用户推送消息请求。
 *
 * @param destination 用户队列目的地（如 /queue/notifications）
 * @param payload     消息负载（JSON 对象）
 */
public record SendToUserRequest(
        @NotBlank(message = "目的地不能为空") String destination,
        Object payload) {
}
