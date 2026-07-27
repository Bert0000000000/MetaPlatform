package com.metaplatform.agent.conversations;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 发送消息请求。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SendMessageRequest {

    /** 消息内容。 */
    @NotBlank(message = "content 不能为空")
    @Size(max = 16384, message = "content 长度不能超过 16384")
    private String content;

    /** 元数据。 */
    private Map<String, Object> metadata;
}
