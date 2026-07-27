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
import java.util.List;
import java.util.Map;

/**
 * Registers the platform's built-in MCP tools (ONT/RAG/ACTION) into the {@code mcp_tool}
 * table on application startup if they are not already present. Tools are registered under
 * the default tenant and are wired to their domain executors via the {@code beanClass} field.
 *
 * <p>v1.3 强约束（SAA 主路径 + 自研兼容路径）：</p>
 * <ul>
 *   <li>原有自研 ONT / RAG / Action Executor 注册逻辑保留不变（兼容路径）；</li>
 *   <li>同时新增 {@code saaBuiltinToolProvider}（SaaBuiltinToolProvider）对应的三个 SAA @Tool
 *       条目，使 mcp_tool 表与 SAA @Tool 注解 Bean 的元数据保持同步，
 *       便于 Spring AI MCP SDK 通过 ToolCallbackResolver 自动发现与暴露。</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BuiltinToolRegistrar {

    private static final String BEAN = "BEAN";
    private static final String SAA_BEAN_NAME = "saaBuiltinToolProvider";
    private static final String ONT_EXECUTOR = OntToolExecutor.class.getName();
    private static final String RAG_EXECUTOR = RagToolExecutor.class.getName();
    private static final String ACTION_EXECUTOR = ActionToolExecutor.class.getName();

    /**
     * SAA @Tool 注解与自研 McpTool 表的元数据映射表。
     * key = mcp_tool.code，value = SAA @Tool 方法名（与 SaaBuiltinToolProvider 中保持一致）。
     */
    private static final Map<String, String> SAA_TOOL_MAP = Map.of(
            "ont_search", "ontSearch",
            "rag_search", "ragSearch",
            "action_execute", "actionExecute"
    );

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

        // SAA @Tool 注解方式暴露的 Tool 元数据注册（v1.3 主路径同步）：
        // 仅在 mcp_tool 表中登记"指向 saaBuiltinToolProvider Bean"的工具条目，
        // 实际调用由 SAA SDK 通过 ToolCallbackResolver 解析；Tool 真实执行仍走 SaaBuiltinToolProvider#ontSearch 等方法。
        registerSsaTool(tenantId, "ont_search", "Ontology 概念检索（SAA @Tool）",
                "{\"type\":\"object\",\"properties\":{\"keyword\":{\"type\":\"string\"},\"topK\":{\"type\":\"integer\"}},\"required\":[\"keyword\"],\"additionalProperties\":true}");
        registerSsaTool(tenantId, "rag_search", "RAG 语义检索（SAA @Tool）",
                "{\"type\":\"object\",\"properties\":{\"query\":{\"type\":\"string\"},\"kbId\":{\"type\":\"string\"},\"topK\":{\"type\":\"integer\"}},\"required\":[\"query\"],\"additionalProperties\":true}");
        registerSsaTool(tenantId, "action_execute", "Action 执行（SAA @Tool）",
                "{\"type\":\"object\",\"properties\":{\"actionId\":{\"type\":\"string\"},\"params\":{\"type\":\"string\"}},\"required\":[\"actionId\"],\"additionalProperties\":true}");
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

    /**
     * 注册 SAA @Tool 注解对应的 mcp_tool 元数据条目。
     * <p>将 code 重命名为带 {@code _saa_} 后缀避免与自研 Executor 注册的同名工具冲突；
     * beanClass 指向 {@link com.metaplatform.mcp.tools.SaaBuiltinToolProvider}，
     * 使运行时仍可通过自研 Tool Executor 引擎按 beanClass 解析调用。</p>
     */
    private void registerSsaTool(String tenantId, String code, String name, String inputSchema) {
        String ssaCode = code + "_saa_bean";
        if (mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, ssaCode)) {
            return;
        }
        String methodName = SAA_TOOL_MAP.getOrDefault(code, code);
        String beanClass = com.metaplatform.mcp.tools.SaaBuiltinToolProvider.class.getName();
        Instant now = Instant.now();
        McpToolEntity entity = McpToolEntity.builder()
                .tenantId(tenantId)
                .name(name)
                .code(ssaCode)
                .description(name + "（Bean 指向 " + SAA_BEAN_NAME + "#" + methodName + "）")
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
        log.info("Registered SAA @Tool entry: code={} bean={}#{}", ssaCode, SAA_BEAN_NAME, methodName);
    }

    /**
     * 获取已注册的 SAA 工具方法列表（用于 health check / 监控）。
     */
    public List<String> listSsaToolMethods() {
        return List.copyOf(SAA_TOOL_MAP.values());
    }
}