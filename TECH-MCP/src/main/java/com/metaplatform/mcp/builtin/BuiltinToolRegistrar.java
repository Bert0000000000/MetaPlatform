package com.metaplatform.mcp.builtin;

import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Registers the platform's built-in MCP tools (ONT/RAG/ACTION) into the {@code mcp_tool}
 * table on application startup if they are not already present. Tools are registered under
 * the default tenant and are wired to their domain executors via the {@code beanClass} field.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BuiltinToolRegistrar {

    private static final String BEAN = "BEAN";
    private static final String ONT_EXECUTOR = OntToolExecutor.class.getName();
    private static final String RAG_EXECUTOR = RagToolExecutor.class.getName();
    private static final String ACTION_EXECUTOR = ActionToolExecutor.class.getName();

    private final McpToolRepository mcpToolRepository;

    @EventListener(ApplicationReadyEvent.class)
    public void registerBuiltinTools() {
        String tenantId = TenantContext.getOrDefault();

        register(tenantId, "ont_query_concepts", "查询本体概念", ONT_EXECUTOR,
                "{\"type\":\"object\",\"properties\":{\"keyword\":{\"type\":\"string\"}},\"additionalProperties\":true}");
        register(tenantId, "ont_query_entities", "查询本体实体", ONT_EXECUTOR,
                "{\"type\":\"object\",\"properties\":{\"conceptCode\":{\"type\":\"string\"}},\"additionalProperties\":true}");
        register(tenantId, "ont_query_graph", "查询本体图谱", ONT_EXECUTOR,
                "{\"type\":\"object\",\"properties\":{\"depth\":{\"type\":\"integer\"}},\"additionalProperties\":true}");
        register(tenantId, "rag_search", "RAG 知识检索", RAG_EXECUTOR,
                "{\"type\":\"object\",\"properties\":{\"query\":{\"type\":\"string\"},\"knowledgeBaseId\":{\"type\":\"string\"}},\"required\":[\"query\"],\"additionalProperties\":true}");
        register(tenantId, "rag_list_knowledge_bases", "列出 RAG 知识库", RAG_EXECUTOR,
                "{\"type\":\"object\",\"properties\":{},\"additionalProperties\":true}");
        register(tenantId, "action_execute", "执行 Action", ACTION_EXECUTOR,
                "{\"type\":\"object\",\"properties\":{\"actionCode\":{\"type\":\"string\"},\"params\":{\"type\":\"object\"}},\"required\":[\"actionCode\"],\"additionalProperties\":true}");
        register(tenantId, "action_list", "列出可执行 Action", ACTION_EXECUTOR,
                "{\"type\":\"object\",\"properties\":{},\"additionalProperties\":true}");
    }

    private void register(String tenantId, String code, String name, String beanClass, String inputSchema) {
        if (mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, code)) {
            return;
        }
        Instant now = Instant.now();
        McpToolEntity entity = McpToolEntity.builder()
                .tenantId(tenantId)
                .name(name)
                .code(code)
                .description(name)
                .inputSchema(inputSchema)
                .outputSchema("{}")
                .toolType(BEAN)
                .beanClass(beanClass)
                .enabled(Boolean.TRUE)
                .version("1.0.0")
                .createdAt(now)
                .updatedAt(now)
                .build();
        mcpToolRepository.save(entity);
        log.info("Registered built-in MCP tool: {}", code);
    }
}
