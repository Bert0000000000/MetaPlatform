package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * MCP {@code prompts/get} response. Contains the rendered template as one or more
 * {@link PromptMessage}s.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GetPromptResult {

    /** Optional short description. */
    private String description;

    /** Rendered messages in order. */
    private List<PromptMessage> messages;
}