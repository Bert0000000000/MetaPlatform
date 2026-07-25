package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Wire-level MCP prompt descriptor. Mirrors {@code McpPromptTemplateEntity} without exposing
 * persistence fields.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PromptSchema {

    /** Stable prompt identifier. */
    private String name;

    /** Human-readable title. */
    private String title;

    /** Short description. */
    private String description;

    /** Optional list of arguments the prompt expects. */
    private List<PromptArgument> arguments;
}