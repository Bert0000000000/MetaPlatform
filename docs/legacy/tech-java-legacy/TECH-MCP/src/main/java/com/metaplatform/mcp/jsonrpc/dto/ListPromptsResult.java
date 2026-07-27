package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * MCP {@code prompts/list} response.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ListPromptsResult {

    private List<PromptSchema> prompts;

    /** Opaque cursor for the next page; {@code null} when no more pages remain. */
    private String nextCursor;

    /** Reserved metadata. */
    private Map<String, Object> meta;
}