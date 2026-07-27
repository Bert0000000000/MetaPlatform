package com.metaplatform.agent.conversations;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 创建会话请求。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateConversationRequest {

    /** Agent ID。 */
    @NotBlank(message = "agentId 不能为空")
    private String agentId;

    /** 会话标题。 */
    @Builder.Default
    private String title = "";

    /** 会话模式。 */
    @Builder.Default
    private String mode = "chat";
}
