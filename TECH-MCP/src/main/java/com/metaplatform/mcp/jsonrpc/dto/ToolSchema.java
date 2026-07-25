package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Wire-level MCP tool descriptor. {@code inputSchema} is a JSON Schema object as stored on
 * {@code McpToolEntity.inputSchema} (JSONB). Mapped manually rather than reusing the entity
 * to avoid leaking persistence fields.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolSchema {

    /** Stable tool identifier (the entity {@code code}). */
    private String name;

    /** Human-readable title. */
    private String title;

    /** Short description for tool listings. */
    private String description;

    /** JSON Schema object describing the tool's arguments. */
    private Map<String, Object> inputSchema;
}