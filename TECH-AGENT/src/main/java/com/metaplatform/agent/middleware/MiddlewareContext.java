package com.metaplatform.agent.middleware;

import lombok.Data;
import lombok.Builder;

import java.util.*;

/**
 * Middleware Context（P3.1）。
 *
 * <p>贯穿整条 Middleware Chain 的上下文对象。所有 Middleware 共享一个实例。</p>
 */
@Data
@Builder
public class MiddlewareContext {

    private String tenantId;
    private String userId;
    private String agentId;
    private String threadId;
    private String runId;

    /** 原始用户消息 */
    private String userMessage;

    /** Ontology Context Envelope（来自 TECH-ONT /ont/context/build） */
    private Map<String, Object> ontologyEnvelope;

    /** Allowed Tools */
    private List<String> allowedTools;

    /** 当前 Grounding 结果 */
    private Map<String, Object> grounding;

    /** 已收集的 Claims 与 Evidence */
    private List<Map<String, Object>> claims;

    /** 待处理的 Action Proposals */
    private List<Map<String, Object>> actionProposals;

    /** 任何中间件可设置的拒绝原因 */
    private String rejectionReason;
    private boolean rejected;
}
