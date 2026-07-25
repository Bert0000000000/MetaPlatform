package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * MCP {@code completion/complete} response.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CompletionResult {

    private Completion completion;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Completion {

        /** Suggested completion strings. */
        private List<String> values;

        /** Total number of candidates considered (before truncation). */
        private Integer total;

        /** Whether more completions exist beyond the returned slice. */
        private Boolean hasMore;
    }
}