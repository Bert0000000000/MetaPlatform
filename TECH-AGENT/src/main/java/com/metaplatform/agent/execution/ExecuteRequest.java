package com.metaplatform.agent.execution;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Agent 同步 / 流式执行请求。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExecuteRequest {

    /** 输入文本。 */
    @NotBlank(message = "input 不能为空")
    @Size(max = 8192, message = "input 长度不能超过 8192")
    private String input;

    /** 输入类型，默认 TEXT。 */
    @Builder.Default
    private String inputType = "TEXT";

    /** 执行上下文。 */
    private ExecuteContext context;
}
