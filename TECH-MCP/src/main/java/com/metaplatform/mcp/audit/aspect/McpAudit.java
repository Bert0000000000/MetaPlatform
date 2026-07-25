package com.metaplatform.mcp.audit.aspect;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 方法级别的审计注解。Mc pAuditAspect 拦截该注解，
 * 自动写入 mcp_audit_log 与（可选）mcp_outbox。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface McpAudit {

    /**
     * 动作名，例如 "tool.execute"、"server.register"、"client.connect"。
     */
    String action() default "";

    /**
     * 目标类型，例如 "MCP_TOOL"、"MCP_SERVER"、"MCP_CLIENT"。
     */
    String targetType() default "MCP";

    /**
     * 是否为敏感操作（敏感参数将被脱敏）。
     */
    boolean sensitive() default false;
}