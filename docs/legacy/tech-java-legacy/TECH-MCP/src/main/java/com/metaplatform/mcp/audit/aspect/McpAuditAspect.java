package com.metaplatform.mcp.audit.aspect;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.audit.entity.McpAuditLogEntity;
import com.metaplatform.mcp.audit.entity.McpOutboxEntity;
import com.metaplatform.mcp.audit.repository.McpAuditLogRepository;
import com.metaplatform.mcp.audit.repository.McpOutboxRepository;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.common.TraceContext;
import com.metaplatform.mcp.config.McpAuditProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * @McpAudit 注解切面：自动埋点 MCP 关键操作（Tool 调用、Server 注册、Client 连接、JSON-RPC 调用等）。
 * 行为：
 *  1. 写 mcp_audit_log（成功 / 失败）
 *  2. 当 mate.mcp.audit.kafka-outbox-enabled=true 且敏感操作 → 额外写入 mcp_outbox（由 McpOutboxProcessor 投递到 Kafka）
 * 所有 DB 异常仅 WARN，不影响主流程。
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class McpAuditAspect {

    private static final String[] SENSITIVE_KEYS = {"password", "passwd", "secret", "apiKey", "api_key", "token", "credential"};

    private final McpAuditLogRepository auditLogRepository;
    private final McpOutboxRepository outboxRepository;
    private final McpAuditProperties auditProperties;
    private final ObjectMapper objectMapper;

    @Around("@annotation(mcpAudit)")
    public Object around(ProceedingJoinPoint joinPoint, McpAudit mcpAudit) throws Throwable {
        if (!auditProperties.isAopEnabled()) {
            return joinPoint.proceed();
        }
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        String methodName = method.getDeclaringClass().getSimpleName() + "#" + method.getName();

        long startMs = System.currentTimeMillis();
        Object result = null;
        Throwable thrown = null;
        try {
            result = joinPoint.proceed();
            return result;
        } catch (Throwable t) {
            thrown = t;
            throw t;
        } finally {
            long duration = System.currentTimeMillis() - startMs;
            try {
                persistAudit(mcpAudit, methodName, joinPoint.getArgs(), result, thrown, duration);
            } catch (Exception e) {
                log.warn("auditAspect persist failed, method={}, err={}", methodName, e.getMessage());
            }
        }
    }

    private void persistAudit(McpAudit mcpAudit, String methodName, Object[] args,
                             Object result, Throwable thrown, long durationMs) {
        String tenantId = TenantContext.getOrDefault();
        String traceId = TraceContext.getOrCreate();
        String userId = TraceContext.getUserId();
        String status = thrown == null ? "SUCCESS" : "FAILURE";
        Instant now = Instant.now();

        McpAuditLogEntity auditLog = McpAuditLogEntity.builder()
                .tenantId(tenantId)
                .invocationType(mcpAudit.targetType())
                .inputTokens(0)
                .outputTokens(0)
                .durationMs(durationMs)
                .status(status)
                .errorMessage(thrown == null ? null : truncate(thrown.getMessage(), 1000))
                .traceId(traceId)
                .userId(userId)
                .calledAt(now)
                .build();
        auditLogRepository.save(auditLog);

        if (auditProperties.isKafkaOutboxEnabled()) {
            try {
                Map<String, Object> payload = buildOutboxPayload(
                        mcpAudit, methodName, args, result, thrown, durationMs,
                        tenantId, traceId, userId, status, now);
                McpOutboxEntity outbox = McpOutboxEntity.builder()
                        .tenantId(tenantId)
                        .eventType(deriveEventType(mcpAudit))
                        .payload(serialize(payload))
                        .traceId(traceId)
                        .status("PENDING")
                        .retryCount(0)
                        .nextRetryAt(now)
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                outboxRepository.save(outbox);
            } catch (Exception e) {
                log.warn("outbox persist failed, method={}, err={}", methodName, e.getMessage());
            }
        }
    }

    private Map<String, Object> buildOutboxPayload(McpAudit mcpAudit, String methodName, Object[] args,
                                                    Object result, Throwable thrown, long durationMs,
                                                    String tenantId, String traceId, String userId,
                                                    String status, Instant now) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", UUID.randomUUID().toString());
        payload.put("tenantId", tenantId);
        payload.put("action", mcpAudit.action().isBlank() ? methodName : mcpAudit.action());
        payload.put("targetType", mcpAudit.targetType());
        payload.put("methodName", methodName);
        payload.put("args", summarizeArgs(args, mcpAudit.sensitive()));
        payload.put("resultSummary", summarizeResult(result));
        payload.put("durationMs", durationMs);
        payload.put("status", status);
        if (thrown != null) {
            payload.put("errorMessage", truncate(thrown.getMessage(), 500));
            payload.put("errorClass", thrown.getClass().getName());
        }
        payload.put("traceId", traceId);
        payload.put("userId", userId);
        payload.put("calledAt", now.toString());
        return payload;
    }

    private Object summarizeArgs(Object[] args, boolean sensitive) {
        if (args == null || args.length == 0) {
            return List.of();
        }
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < args.length; i++) {
            Object arg = args[i];
            map.put("arg" + i, sanitize(arg, sensitive));
        }
        return map;
    }

    private Object summarizeResult(Object result) {
        if (result == null) {
            return null;
        }
        try {
            String json = objectMapper.writeValueAsString(result);
            return truncate(json, auditProperties.getMaxResponseBytes());
        } catch (JsonProcessingException e) {
            return truncate(String.valueOf(result), auditProperties.getMaxResponseBytes());
        }
    }

    private Object sanitize(Object arg, boolean sensitive) {
        if (arg == null) {
            return null;
        }
        if (!sensitive) {
            return arg;
        }
        if (arg instanceof String s) {
            return "***REDACTED***";
        }
        return "***REDACTED***";
    }

    private boolean looksSensitive(Object arg) {
        if (arg == null) {
            return false;
        }
        String name = arg.getClass().getName().toLowerCase();
        for (String key : SENSITIVE_KEYS) {
            if (name.contains(key.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    private String deriveEventType(McpAudit mcpAudit) {
        String action = mcpAudit.action();
        if (action == null || action.isBlank()) {
            return "MCP_AUDIT";
        }
        String upper = action.toUpperCase();
        if (upper.contains("TOOL")) {
            return "TOOL_CALL";
        }
        return "MCP_REQUEST";
    }

    private String serialize(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        if (max <= 0 || value.length() <= max) {
            return value;
        }
        return value.substring(0, max) + "...";
    }

    /** 检测内部敏感类引用 */
    private boolean isSensitive(Object arg) {
        return arg != null && looksSensitive(arg);
    }
}