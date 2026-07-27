package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * MCP {@code resources/templates/list} response. Currently always empty; reserved for future
 * URI-template support (e.g. {@code ont://concept/{id}}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ListResourceTemplatesResult {

    private List<Map<String, Object>> resourceTemplates;

    private String nextCursor;

    private Map<String, Object> meta;
}