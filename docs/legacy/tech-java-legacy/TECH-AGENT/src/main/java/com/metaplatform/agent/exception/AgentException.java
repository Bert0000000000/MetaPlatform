package com.metaplatform.agent.exception;

import com.metaplatform.agent.common.ErrorCode;
import lombok.Getter;

/**
 * TECH-AGENT 业务异常基类。
 *
 * <p>携带 {@link ErrorCode} 与自定义 message，由 {@link GlobalExceptionHandler}
 * 统一翻译为 HTTP 响应。Service 层抛出此异常（或其子类）即可。</p>
 */
@Getter
public class AgentException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 业务错误码。 */
    private final ErrorCode errorCode;

    /**
     * 以错误码 + 默认 message 构造。
     */
    public AgentException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    /**
     * 以错误码 + 自定义 message 构造。
     */
    public AgentException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    /**
     * 以错误码 + 自定义 message + 原因构造。
     */
    public AgentException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    /**
     * 便捷工厂：参数错误。
     */
    public static AgentException invalidParam(String message) {
        return new AgentException(ErrorCode.INVALID_PARAM, message);
    }

    /**
     * 便捷工厂：Agent 不存在。
     */
    public static AgentException agentNotFound(String agentId) {
        return new AgentException(ErrorCode.AGENT_NOT_FOUND, "Agent 不存在: " + agentId);
    }

    /**
     * 便捷工厂：Agent 未激活。
     */
    public static AgentException agentNotActive(String agentId) {
        return new AgentException(ErrorCode.AGENT_NOT_ACTIVE, "Agent 未激活: " + agentId);
    }

    /**
     * 便捷工厂：Agent Code 重复。
     */
    public static AgentException duplicateAgentCode(String agentCode) {
        return new AgentException(ErrorCode.DUPLICATE_AGENT_CODE, "Agent Code 已存在: " + agentCode);
    }

    /**
     * 便捷工厂：对话不存在。
     */
    public static AgentException conversationNotFound(String conversationId) {
        return new AgentException(ErrorCode.CONVERSATION_NOT_FOUND, "对话不存在: " + conversationId);
    }

    /**
     * 便捷工厂：任务不存在。
     */
    public static AgentException taskNotFound(String taskId) {
        return new AgentException(ErrorCode.TASK_NOT_FOUND, "任务不存在: " + taskId);
    }

    /**
     * 便捷工厂：工具不存在。
     */
    public static AgentException toolNotFound(String toolId) {
        return new AgentException(ErrorCode.TOOL_NOT_FOUND, "工具不存在: " + toolId);
    }

    /**
     * 便捷工厂：LLMGW 不可用。
     */
    public static AgentException llmgwUnavailable(String message) {
        return new AgentException(ErrorCode.LLMGW_UNAVAILABLE, message);
    }
}
