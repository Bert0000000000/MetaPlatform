package com.metaplatform.mcp.builtin;

/**
 * Contract for BEAN-type MCP tool executors. Built-in executors (ONT/RAG/ACTION)
 * implement this interface so the {@code ToolExecutorEngine} can locate and invoke
 * them via the Spring {@link org.springframework.context.ApplicationContext}.
 */
public interface ToolExecutor {

    /**
     * Execute the tool.
     *
     * @param toolCode the tool's unique code (e.g. {@code ont_query_concepts}), used by
     *                 domain executors to route to the correct downstream sub-endpoint
     * @param input    raw JSON input string
     * @return raw JSON output string
     */
    String execute(String toolCode, String input) throws Exception;
}
