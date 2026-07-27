package com.metaplatform.msg.consumer;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

/**
 * 平台级统一事件协议（P0.4.3）。
 *
 * <p>所有 Ontology / Document / Agent / WFE 事件统一采用本信封，
 * 既能被 Jackson 反序列化为具体 DTO，也能通过 {@link #getPayloadAsMap()}
 * 保留原始 JSON 字段。</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EventEnvelope<T>(
        String eventId,
        String eventType,
        String tenantId,
        String traceId,
        String source,            // 发布方服务名
        Instant occurredAt,
        T payload
) {
    /** 反序列化时使用 */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getPayloadAsMap() {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of("value", payload);
    }
}
