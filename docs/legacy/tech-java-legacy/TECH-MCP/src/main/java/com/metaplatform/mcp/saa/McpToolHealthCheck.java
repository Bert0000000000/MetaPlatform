package com.metaplatform.mcp.saa;

import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.builtin.BuiltinToolRegistrar;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 启动时 SAA @Tool 与 mcp_tool 表映射完整性校验。
 *
 * <p>v1.3 强约束：SAA 作为主路径暴露的 Tool（{@code SaaBuiltinToolProvider}）必须在
 * mcp_tool 表中存在对应元数据条目，否则 {@code /tools/list} 返回结果与 SAA @Tool
 * 自动发现结果不一致，会导致 MCP Client 看到的 Tool 列表与实际可调用方法不匹配。</p>
 *
 * <p>校验策略：</p>
 * <ol>
 *   <li>枚举 {@code SAA_TOOL_CODES}（SAA @Tool 注解暴露的 code 列表）；</li>
 *   <li>按当前租户查询 mcp_tool 中是否存在 {@code <code>_saa_bean} 形式的记录；</li>
 *   <li>缺失则 WARN 级别告警（不抛异常，避免阻断启动）。</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class McpToolHealthCheck {

    /**
     * SAA @Tool 注解暴露的标准 code 列表（与 SaaBuiltinToolProvider 的 @Tool(name=...) 一致）。
     */
    private static final Map<String, String> SAA_TOOL_CODES = Map.of(
            "ont_search", "Ontology 概念检索",
            "rag_search", "RAG 语义检索",
            "action_execute", "Action 执行"
    );

    private final McpToolRepository mcpToolRepository;
    private final BuiltinToolRegistrar builtinToolRegistrar;

    @PostConstruct
    public void earlyCheck() {
        try {
            checkInternal();
        } catch (Exception e) {
            log.warn("SAA Tool health check failed during PostConstruct: {}", e.getMessage());
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            checkInternal();
        } catch (Exception e) {
            log.warn("SAA Tool health check failed during ApplicationReady: {}", e.getMessage());
        }
    }

    private void checkInternal() {
        String tenantId = TenantContext.getOrDefault();
        log.info("SAA Tool ↔ mcp_tool mapping health check start (tenantId={}, declared tools={})",
                tenantId, SAA_TOOL_CODES.size());

        int okCount = 0;
        int missingCount = 0;
        for (Map.Entry<String, String> entry : SAA_TOOL_CODES.entrySet()) {
            String code = entry.getKey();
            String expectedSubCode = code + "_saa_bean";
            java.util.Optional<McpToolEntity> found =
                    mcpToolRepository.findByTenantIdAndCodeAndDeletedAtIsNull(tenantId, expectedSubCode);
            if (found.isPresent()) {
                okCount++;
                log.debug("SAA Tool mapping OK: {} → mcp_tool.code={} id={}",
                        code, expectedSubCode, found.get().getId());
            } else {
                missingCount++;
                log.warn("SAA Tool 未注册到 MCP: code={} expected_subcode={} (SAA @Tool 注解暴露但 mcp_tool 缺记录)",
                        code, expectedSubCode);
            }
        }
        log.info("SAA Tool ↔ mcp_tool mapping health check done: ok={} missing={} total={}",
                okCount, missingCount, SAA_TOOL_CODES.size());

        // 交叉校验 BuiltinToolRegistrar 中声明的 SAA 方法列表与 SAA_TOOL_CODES 是否一致。
        List<String> declaredMethods = builtinToolRegistrar.listSsaToolMethods();
        if (declaredMethods.size() != SAA_TOOL_CODES.size()) {
            log.warn("BuiltinToolRegistrar.listSsaToolMethods() 与 SAA_TOOL_CODES 数量不一致: declared={} expected={}",
                    declaredMethods.size(), SAA_TOOL_CODES.size());
        }
    }

    /**
     * 提供给 health check 端点的快照视图。
     */
    public java.util.Map<String, Object> snapshot() {
        return java.util.Map.of(
                "ssaToolCodes", SAA_TOOL_CODES.keySet(),
                "ssaToolSize", SAA_TOOL_CODES.size(),
                "ssaBeanDeclaredMethods", builtinToolRegistrar.listSsaToolMethods()
        );
    }
}