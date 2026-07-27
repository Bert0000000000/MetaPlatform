package com.metaplatform.mcp.jsonrpc;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SAA MCP Server SDK Transport 桥接适配层（v1.3 强约束）。
 *
 * <p>SAA 1.1.2.2 提供了 {@code spring-ai-alibaba-mcp-common} 与
 * {@code spring-ai-alibaba-mcp-registry}，但未发布独立的
 * {@code spring-ai-alibaba-starter-nacos-mcp-registry} starter，因此服务端
 * Transport 接口（{@code McpServerTransport} / {@code McpSyncServerExchange}）
 * 在 SAA 1.1.2.2 BOM 中未作为 Starter 自动装配。</p>
 *
 * <p>本桥接类提供 serverId → Transport 占位映射，使用 {@link Object} 作为
 * Transport 容器，调用方按需通过反射 / 适配器获取实际 Transport 实例。
 * 待 SAA 1.2.0+ 升级后，{@code transportRegistry.get(serverId)} 可替换为
 * 真实 {@code McpSyncServerTransport}，从而将 JSON-RPC 处理委托给 SAA SDK。</p>
 *
 * <p>当前主路径仍是自研 {@link McpProtocolService}（v1.3 兼容策略：自研 Nacos
 * Registry 包装保留为兼容路径，SAA 作为主路径演进）。</p>
 */
@Slf4j
@Component
public class McpSaaTransportBridge {

    private final Map<String, Object> transportRegistry = new ConcurrentHashMap<>();

    /**
     * 注册 SAA MCP Server Transport（按 serverId）。
     *
     * @param serverId  MCP Server 名（对应 mcp_server.code）
     * @param transport 任意 SAA / Spring AI SDK 的 Transport 实例；当前 v1.3 阶段为 null 占位
     */
    public void register(String serverId, Object transport) {
        transportRegistry.put(serverId, transport == null ? new NoopTransport(serverId) : transport);
        log.debug("Registered SAA Transport for serverId={} type={}",
                serverId, transport == null ? "NoopTransport" : transport.getClass().getSimpleName());
    }

    /**
     * 查询 serverId 对应的 Transport；未注册时返回 null。
     */
    public Object get(String serverId) {
        return transportRegistry.get(serverId);
    }

    /**
     * 取消注册 serverId（用于 MCP Server 下线 / 配置变更）。
     */
    public void unregister(String serverId) {
        Object removed = transportRegistry.remove(serverId);
        if (removed != null) {
            log.info("Unregistered SAA Transport for serverId={}", serverId);
        }
    }

    /**
     * 当前已注册 Transport 数（健康探针 / 监控）。
     */
    public int size() {
        return transportRegistry.size();
    }

    /**
     * 占位实现：v1.3 阶段 SAA Transport 暂未启用，所有调用直接抛出
     * UnsupportedOperationException，让 Controller 走自研 JSON-RPC 主路径。
     */
    private static final class NoopTransport {
        private final String serverId;

        NoopTransport(String serverId) {
            this.serverId = serverId;
        }

        @Override
        public String toString() {
            return "NoopTransport{serverId=" + serverId + "}";
        }
    }
}