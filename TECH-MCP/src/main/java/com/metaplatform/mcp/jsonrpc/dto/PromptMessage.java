package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Single message in a {@link GetPromptResult} messages list. {@link #role} is one of
 * {@code "user"} or {@code "assistant"}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PromptMessage {

    private String role;

    /** Text/image/resource payload. */
    private Content content;
}