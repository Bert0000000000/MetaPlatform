package com.metaplatform.a2a.exception;

import com.metaplatform.a2a.common.ErrorCode;
import lombok.Getter;

/**
 * TECH-A2A 业务异常基类。
 *
 * <p>对应 Python {@code app.common.errors.BizException}。
 * 携带 {@link ErrorCode} 与自定义 message，由 {@link GlobalExceptionHandler}
 * 统一翻译为 HTTP 响应。</p>
 */
@Getter
public class A2aException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final ErrorCode errorCode;

    public A2aException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    public A2aException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public A2aException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public static A2aException invalidParam(String message) {
        return new A2aException(ErrorCode.INVALID_PARAM, message);
    }

    public static A2aException unauthorized(String message) {
        return new A2aException(ErrorCode.UNAUTHORIZED, message);
    }

    public static A2aException agentNotFound(String agentId) {
        return new A2aException(ErrorCode.AGENT_NOT_FOUND, "Agent 不存在: " + agentId);
    }

    public static A2aException agentAlreadyRegistered(String agentId) {
        return new A2aException(ErrorCode.AGENT_ALREADY_REGISTERED, "Agent 已注册: agentId=" + agentId);
    }

    public static A2aException taskNotFound(String taskId) {
        return new A2aException(ErrorCode.TASK_NOT_FOUND, "Task 不存在: taskId=" + taskId);
    }

    public static A2aException taskAlreadyCompleted(String taskId, String status) {
        return new A2aException(ErrorCode.TASK_ALREADY_COMPLETED,
                "Task 已终态，无法取消: taskId=" + taskId + ", status=" + status);
    }

    public static A2aException messageNotFound(String messageId) {
        return new A2aException(ErrorCode.MESSAGE_NOT_FOUND, "消息不存在: messageId=" + messageId);
    }

    public static A2aException cardNotFound(String cardId) {
        return new A2aException(ErrorCode.CARD_NOT_FOUND, "Agent Card 不存在: cardId=" + cardId);
    }

    public static A2aException duplicateCard(String name) {
        return new A2aException(ErrorCode.DUPLICATE_AGENT_CARD, "Agent Card 名称已存在: " + name);
    }

    public static A2aException keyNotFound(String keyId) {
        return new A2aException(ErrorCode.KEY_NOT_FOUND, "API Key 不存在: keyId=" + keyId);
    }

    public static A2aException upstreamUnavailable(String message) {
        return new A2aException(ErrorCode.UPSTREAM_UNAVAILABLE, message);
    }

    public static A2aException invalidRequest(String message) {
        return new A2aException(ErrorCode.INVALID_REQUEST, message);
    }
}
