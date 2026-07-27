package com.metaplatform.mcp.tools;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * SAA @Tool 注解方式暴露的内置 Tool。
 *
 * <p>Spring AI MCP SDK 通过 ToolCallbackResolver 自动发现 @Tool 注解方法，
 * 并在 MCP Server 注册周期内将其暴露给 MCP Client；同时本类的工具元信息通过
 * {@link com.metaplatform.mcp.builtin.BuiltinToolRegistrar} 同步入库到 mcp_tool 表。</p>
 *
 * <p>v1.3 强约束：SAA 作为主路径、自研 JSON-RPC 作为兼容路径。
 * 本类是 SAA 主路径的"Bean 端"——@Tool 注解暴露 ONT / RAG / Action 三类基础能力。
 * Tool 的真实调用仍由自研 {@code McpProtocolService} 与后端 OntToolExecutor / RagToolExecutor /
 * ActionToolExecutor 完成（SAA @Tool 仅负责描述声明与 MCP Client 元信息发现）。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SaaBuiltinToolProvider {

    @Tool(name = "ont_search", description = "Ontology 概念检索：根据关键词查找相关概念")
    public String ontSearch(
            @ToolParam(description = "查询关键词") String keyword,
            @ToolParam(description = "返回前 K 个") Integer topK) {
        log.info("MCP Tool(Bean): ont_search | keyword={} topK={}", keyword, topK);
        // 实际调用由 McpProtocolService → OntToolExecutor → TECH-ONT（HTTP / WebClient）
        return "{\"results\": []}";
    }

    @Tool(name = "rag_search", description = "RAG 检索：基于知识库的语义检索")
    public String ragSearch(
            @ToolParam(description = "查询文本") String query,
            @ToolParam(description = "知识库 ID") String kbId,
            @ToolParam(description = "返回前 K 个") Integer topK) {
        log.info("MCP Tool(Bean): rag_search | query={} kbId={} topK={}", query, kbId, topK);
        return "{\"results\": []}";
    }

    @Tool(name = "action_execute", description = "执行 Action：调用平台 Action Engine")
    public String actionExecute(
            @ToolParam(description = "Action ID") String actionId,
            @ToolParam(description = "Action 参数 (JSON)") String params) {
        log.info("MCP Tool(Bean): action_execute | actionId={} params={}", actionId, params);
        return "{\"status\": \"ok\"}";
    }
}