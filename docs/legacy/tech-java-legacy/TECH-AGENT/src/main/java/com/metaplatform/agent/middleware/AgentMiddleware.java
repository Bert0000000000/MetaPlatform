package com.metaplatform.agent.middleware;

/**
 * Agent Middleware 抽象（P3.1）。
 *
 * <p>DeerFlow / SAA Runtime 的可插拔拦截点。Ontology-Native DeerFlow 通过
 * 这套抽象注入 5 个 Ontology 相关的中间件：</p>
 *
 * <ol>
 *   <li>{@link com.metaplatform.agent.middleware.OntologyContextMiddleware}</li>
 *   <li>{@link com.metaplatform.agent.middleware.OntologyGroundingMiddleware}</li>
 *   <li>{@link com.metaplatform.agent.middleware.OntologyPermissionMiddleware}</li>
 *   <li>{@link com.metaplatform.agent.middleware.OntologyEvidenceMiddleware}</li>
 *   <li>{@link com.metaplatform.agent.middleware.OntologyActionGuardMiddleware}</li>
 * </ol>
 */
public interface AgentMiddleware {

    /**
     * 前置：在 Agent 执行前调用
     */
    default void beforeExecution(MiddlewareContext context) {}

    /**
     * 工具调用前：每个 Tool Call 调用一次
     */
    default void beforeToolCall(MiddlewareContext context, ToolCall toolCall) {}

    /**
     * 工具调用后
     */
    default void afterToolCall(MiddlewareContext context, ToolCall toolCall, Object result) {}

    /**
     * 后置：在 Agent 执行后调用
     */
    default void afterExecution(MiddlewareContext context) {}

    /**
     * 优先级：数字越小越早执行
     */
    int order();

    /**
     * 中间件名称（用于日志）
     */
    default String name() { return getClass().getSimpleName(); }
}
