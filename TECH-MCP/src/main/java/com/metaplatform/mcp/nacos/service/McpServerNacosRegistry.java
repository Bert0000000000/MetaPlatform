package com.metaplatform.mcp.nacos.service;

import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.exception.NacosException;
import com.alibaba.nacos.api.naming.NamingService;
import com.alibaba.nacos.api.naming.pojo.Instance;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.config.McpNacosProperties;
import com.metaplatform.mcp.nacos.entity.McpNacosSyncStateEntity;
import com.metaplatform.mcp.nacos.entity.McpToolNacosMetaEntity;
import com.metaplatform.mcp.nacos.repository.McpNacosSyncStateRepository;
import com.metaplatform.mcp.nacos.repository.McpToolNacosMetaRepository;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;

/**
 * 自研封装：将 mcp_server / mcp_tool 表变更同步为 Nacos 3.0+ Registry 服务实例。
 * 服务命名规则：mate-mcp-server-{serverId} / mate-mcp-tool-{toolCode}
 * 所有外部依赖调用都包裹 try-catch：Nacos 不可达仅 WARN，不抛异常。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class McpServerNacosRegistry {

    public static final String ENTITY_TYPE_SERVER = "MCP_SERVER";
    public static final String ENTITY_TYPE_TOOL = "MCP_TOOL";

    public static final String SYNC_STATUS_PENDING = "PENDING";
    public static final String SYNC_STATUS_SYNCED = "SYNCED";
    public static final String SYNC_STATUS_REMOVED = "REMOVED";
    public static final String SYNC_STATUS_FAILED = "FAILED";

    private final McpServerRepository serverRepository;
    private final McpToolRepository toolRepository;
    private final McpNacosSyncStateRepository syncStateRepository;
    private final McpToolNacosMetaRepository toolNacosMetaRepository;
    private final McpNacosProperties nacosProperties;

    @Value("${spring.cloud.nacos.discovery.server-addr:localhost:8848}")
    private String nacosServerAddr;

    private volatile NamingService namingService;

    @PostConstruct
    public void initSync() {
        if (!nacosProperties.isRegistryEnabled()) {
            log.info("McpServerNacosRegistry disabled by config (mate.mcp.nacos.registry-enabled=false)");
            return;
        }
        try {
            this.namingService = createNamingService();
            List<McpServerEntity> activeServers = findActiveServers();
            int successCount = 0;
            for (McpServerEntity server : activeServers) {
                if (registerServer(server)) {
                    successCount++;
                }
            }
            log.info("McpServerNacosRegistry initSync done, activeServers={}, synced={}",
                    activeServers.size(), successCount);
        } catch (Exception e) {
            log.warn("McpServerNacosRegistry initSync failed (Nacos unavailable, will retry on next schedule)", e);
        }
    }

    @PreDestroy
    public void shutdown() {
        if (namingService != null) {
            try {
                namingService.shutDown();
            } catch (NacosException e) {
                log.warn("NamingService shutDown failed", e);
            }
        }
    }

    /**
     * 注册单个 MCP Server 到 Nacos。
     */
    public boolean registerServer(McpServerEntity server) {
        if (server == null || server.getId() == null) {
            return false;
        }
        String group = nacosProperties.getMcpServerGroup();
        String serviceName = "mate-mcp-server-" + server.getId();
        try {
            Instance instance = new Instance();
            instance.setIp(server.getHost() == null ? "localhost" : server.getHost());
            instance.setPort(server.getPort() == null ? 0 : server.getPort());
            instance.setEphemeral(true);
            instance.setHealthy(server.getStatus() != null && "ACTIVE".equalsIgnoreCase(server.getStatus()));
            instance.getMetadata().put("tenantId", server.getTenantId());
            instance.getMetadata().put("protocolVersion", "2025-03-26");
            instance.getMetadata().put("capabilities", "tools,resources,prompts");
            instance.getMetadata().put("transport", server.getTransportType());
            instance.getMetadata().put("status", server.getStatus());
            if (server.getHealthCheckUrl() != null) {
                instance.getMetadata().put("healthCheckUrl", server.getHealthCheckUrl());
            }
            namingService.registerInstance(serviceName, group, instance);

            upsertSyncState(server.getTenantId(), server.getId().toString(),
                    group, serviceName, SYNC_STATUS_SYNCED, null);
            log.debug("Registered MCP server to Nacos: serviceName={}, group={}", serviceName, group);
            return true;
        } catch (Exception e) {
            log.warn("registerServer failed, serverId={}, err={}", server.getId(), e.getMessage());
            upsertSyncState(server.getTenantId(), server.getId().toString(),
                    group, serviceName, SYNC_STATUS_FAILED, e.getMessage());
            return false;
        }
    }

    /**
     * 从 Nacos 注销。
     */
    public boolean unregisterServer(String tenantId, String serverId) {
        String group = nacosProperties.getMcpServerGroup();
        String serviceName = "mate-mcp-server-" + serverId;
        try {
            List<Instance> existing = namingService.getAllInstances(serviceName, group);
            for (Instance instance : existing) {
                try {
                    namingService.deregisterInstance(serviceName, group, instance);
                } catch (Exception e) {
                    log.warn("deregisterInstance failed, serviceName={}, ip={}, err={}",
                            serviceName, instance.getIp(), e.getMessage());
                }
            }
            upsertSyncState(tenantId, serverId, group, serviceName, SYNC_STATUS_REMOVED, null);
            log.info("Unregistered MCP server from Nacos: serviceName={}, group={}, removed={}",
                    serviceName, group, existing.size());
            return true;
        } catch (Exception e) {
            log.warn("unregisterServer failed, serverId={}, err={}", serverId, e.getMessage());
            return false;
        }
    }

    /**
     * 注册 Tool 到 Nacos（按 toolCode 区分）。
     */
    public boolean registerTool(McpToolEntity tool) {
        if (tool == null || tool.getCode() == null) {
            return false;
        }
        String group = nacosProperties.getMcpToolGroup();
        String serviceName = "mate-mcp-tool-" + tool.getCode();
        try {
            Instance instance = new Instance();
            instance.setIp("localhost");
            instance.setPort(0);
            instance.setEphemeral(true);
            instance.setHealthy(Boolean.TRUE.equals(tool.getEnabled()));
            instance.getMetadata().put("toolName", tool.getName());
            instance.getMetadata().put("toolVersion", tool.getVersion() == null ? "1.0.0" : tool.getVersion());
            if (tool.getServerId() != null) {
                instance.getMetadata().put("serverId", tool.getServerId().toString());
            }
            instance.getMetadata().put("serverType", tool.getToolType());
            instance.getMetadata().put("capabilities", "tool:" + tool.getCode());
            namingService.registerInstance(serviceName, group, instance);

            upsertToolMeta(tool, SYNC_STATUS_SYNCED);
            log.debug("Registered MCP tool to Nacos: serviceName={}, group={}", serviceName, group);
            return true;
        } catch (Exception e) {
            log.warn("registerTool failed, toolCode={}, err={}", tool.getCode(), e.getMessage());
            upsertToolMeta(tool, SYNC_STATUS_FAILED);
            return false;
        }
    }

    /**
     * @Scheduled 定时同步所有 status=ACTIVE 的 server（5 分钟）。
     */
    @Scheduled(fixedRateString = "#{T(java.time.Duration).parse('PT5M').toMillis()}",
            initialDelayString = "#{T(java.time.Duration).parse('PT1M').toMillis()}")
    public void syncAllActiveServers() {
        if (!nacosProperties.isRegistryEnabled()) {
            return;
        }
        if (namingService == null) {
            try {
                this.namingService = createNamingService();
            } catch (Exception e) {
                log.warn("syncAllActiveServers: Nacos not ready, skip this round: {}", e.getMessage());
                return;
            }
        }
        try {
            List<McpServerEntity> activeServers = findActiveServers();
            int synced = 0;
            for (McpServerEntity server : activeServers) {
                if (registerServer(server)) {
                    synced++;
                }
            }
            if (!activeServers.isEmpty()) {
                log.info("syncAllActiveServers done, total={}, synced={}", activeServers.size(), synced);
            }
        } catch (Exception e) {
            log.warn("syncAllActiveServers failed", e);
        }
    }

    private NamingService createNamingService() throws NacosException {
        Properties props = new Properties();
        props.put("serverAddr", nacosServerAddr);
        props.put("namespace", nacosProperties.getNamespace());
        return NacosFactory.createNamingService(props);
    }

    private List<McpServerEntity> findActiveServers() {
        try {
            return serverRepository.findAll().stream()
                    .filter(s -> s.getDeletedAt() == null)
                    .filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus()))
                    .toList();
        } catch (Exception e) {
            log.warn("findActiveServers failed", e);
            return List.of();
        }
    }

    private void upsertSyncState(String tenantId, String entityId, String group,
                                  String nacosDataId, String status, String errorMessage) {
        try {
            Optional<McpNacosSyncStateEntity> opt =
                    syncStateRepository.findByTenantIdAndEntityTypeAndEntityId(
                            tenantId, ENTITY_TYPE_SERVER, entityId);
            McpNacosSyncStateEntity state = opt.orElseGet(() -> McpNacosSyncStateEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .entityType(ENTITY_TYPE_SERVER)
                    .entityId(entityId)
                    .build());
            state.setNacosGroup(group);
            state.setNacosDataId(nacosDataId);
            state.setSyncStatus(status);
            state.setLastSyncedAt(OffsetDateTime.now(ZoneOffset.UTC));
            state.setLastError(errorMessage);
            syncStateRepository.save(state);
        } catch (Exception e) {
            log.warn("upsertSyncState failed, entityId={}, err={}", entityId, e.getMessage());
        }
    }

    private void upsertToolMeta(McpToolEntity tool, String status) {
        try {
            String toolVersion = tool.getVersion() == null ? "1.0.0" : tool.getVersion();
            Optional<McpToolNacosMetaEntity> opt =
                    toolNacosMetaRepository.findByToolIdAndToolVersion(
                            tool.getId().toString(), toolVersion);
            McpToolNacosMetaEntity meta = opt.orElseGet(() -> McpToolNacosMetaEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tool.getTenantId())
                    .toolId(tool.getId().toString())
                    .toolName(tool.getName())
                    .toolVersion(toolVersion)
                    .build());
            if (tool.getServerId() != null) {
                meta.setServerId(tool.getServerId().toString());
            }
            meta.setServerType(tool.getToolType());
            meta.setCapabilities("[\"tool:" + tool.getCode() + "\"]");
            meta.setNacosEndpoint(nacosProperties.getNamespace()
                    + "/" + nacosProperties.getMcpToolGroup()
                    + "/mate-mcp-tool-" + tool.getCode());
            meta.setPublishedAt(OffsetDateTime.now(ZoneOffset.UTC));
            toolNacosMetaRepository.save(meta);
            log.debug("upsertToolMeta persisted, toolCode={}, status={}", tool.getCode(), status);
        } catch (Exception e) {
            log.warn("upsertToolMeta failed, toolCode={}, err={}", tool.getCode(), e.getMessage());
        }
    }

    /** 仅供测试 / 内部引用 */
    public String resolveServerServiceName(String serverId) {
        return "mate-mcp-server-" + serverId;
    }
}