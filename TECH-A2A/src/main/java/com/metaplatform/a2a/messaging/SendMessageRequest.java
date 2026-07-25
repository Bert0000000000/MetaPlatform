package com.metaplatform.a2a.messaging;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 发送消息请求。
 *
 * <p>对应 Python {@code app.messaging.schemas.MessageSendRequest}。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageRequest {

    @NotBlank
    @Size(max = 128)
    private String fromAgentId;

    @NotBlank
    @Size(max = 128)
    private String toAgentId;

    /** 消息类型：text / json / command / notification。 */
    private String messageType = "text";

    /** 消息内容（JSON 对象）。 */
    private Map<String, Object> content;

    /** 过期时间（可选，ISO 8601）。 */
    private String expiresAt;
}
