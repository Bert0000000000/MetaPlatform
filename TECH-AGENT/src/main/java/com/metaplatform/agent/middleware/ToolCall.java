package com.metaplatform.agent.middleware;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Tool Call 元数据（P3.1）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolCall {
    private String toolName;
    private Map<String, Object> arguments;
    private String idempotencyKey;
}
