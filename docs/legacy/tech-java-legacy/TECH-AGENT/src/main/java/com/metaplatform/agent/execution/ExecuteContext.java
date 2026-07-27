package com.metaplatform.agent.execution;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 执行上下文，由调用方传入。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExecuteContext {

    /** 用户 ID。 */
    private String userId;

    /** 会话 ID。 */
    private String conversationId;

    /** 任务 ID。 */
    private String taskId;

    /** 上下文变量。 */
    private Map<String, Object> variables;
}
