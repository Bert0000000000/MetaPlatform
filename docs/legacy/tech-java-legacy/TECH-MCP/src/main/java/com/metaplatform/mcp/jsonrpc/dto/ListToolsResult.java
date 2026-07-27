package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * MCP {@code tools/list} response. See also {@link ListResourcesResult} and
 * {@link ListPromptsResult} which share the same wire shape.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ListToolsResult {

    private List<ToolSchema> tools;

    /** Opaque cursor for the next page; {@code null} when no more pages remain. */
    private String nextCursor;

    /** Reserved metadata. */
    private Map<String, Object> meta;
}