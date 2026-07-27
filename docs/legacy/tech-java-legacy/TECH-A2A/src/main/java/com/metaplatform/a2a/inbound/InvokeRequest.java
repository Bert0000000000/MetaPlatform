package com.metaplatform.a2a.inbound;

import lombok.Data;

import java.util.Map;

/**
 * 语义化 invoke 请求体。
 *
 * <p>PRD 要求 {@code POST /api/v1/a2a/agents/{agentId}/invoke} 的请求体格式。</p>
 */
@Data
public class InvokeRequest {

    /** 任务输入数据。 */
    private Map<String, Object> input;

    /** 页面上下文（可选）。 */
    private Map<String, Object> pageContext;

    /** 是否流式返回（默认 false）。 */
    private Boolean streaming;
}
