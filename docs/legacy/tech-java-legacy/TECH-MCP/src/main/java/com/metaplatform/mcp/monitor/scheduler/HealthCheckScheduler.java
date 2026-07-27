package com.metaplatform.mcp.monitor.scheduler;

import com.metaplatform.mcp.client.entity.McpClientConnectionEntity;
import com.metaplatform.mcp.client.repository.McpClientConnectionRepository;
import com.metaplatform.mcp.monitor.config.McpHealthCheckProperties;
import com.metaplatform.mcp.monitor.entity.McpHealthCheckEntity;
import com.metaplatform.mcp.monitor.repository.McpHealthCheckRepository;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "mate.mcp.health-check.enabled", havingValue = "true", matchIfMissing = true)
public class HealthCheckScheduler {

    private final McpServerRepository serverRepository;
    private final McpClientConnectionRepository clientRepository;
    private final McpHealthCheckRepository healthCheckRepository;
    private final WebClient.Builder webClientBuilder;
    private final McpHealthCheckProperties properties;

    @Scheduled(fixedRateString = "#{@mcpHealthCheckProperties.intervalSeconds * 1000}")
    public void checkAll() {
        serverRepository.findAll(Sort.unsorted()).stream()
                .filter(server -> server.getDeletedAt() == null && "ACTIVE".equalsIgnoreCase(server.getStatus()))
                .forEach(this::checkServer);
        clientRepository.findAll(Sort.unsorted()).stream()
                .filter(client -> client.getDeletedAt() == null && "ENABLED".equalsIgnoreCase(client.getStatus()))
                .forEach(this::checkClient);
    }

    private void checkServer(McpServerEntity server) {
        String url = server.getHealthCheckUrl();
        if (url == null || url.isBlank()) {
            url = server.getEndpointUrl();
        }
        final String targetUrl = url;
        execute("SERVER", server.getId().toString(), server.getTenantId(), () -> {
            webClientBuilder.build().get()
                    .uri(targetUrl)
                    .retrieve()
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                    .block();
            return null;
        });
    }

    private void checkClient(McpClientConnectionEntity client) {
        execute("CLIENT", client.getId().toString(), client.getTenantId(), () -> {
            webClientBuilder.build().post()
                    .uri(client.getServerUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "jsonrpc", "2.0",
                            "id", "health-check",
                            "method", "initialize",
                            "params", Map.of("protocolVersion", "2025-03-26", "capabilities", Map.of(),
                                    "clientInfo", Map.of("name", "tech-mcp-health-check", "version", "0.0.1"))))
                    .retrieve()
                    .toBodilessEntity()
                    .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                    .block();
            return null;
        });
    }

    private void execute(String targetType, String targetId, String tenantId,
                         java.util.concurrent.Callable<Void> probe) {
        long startNanos = System.nanoTime();
        String status = "UP";
        String errorMessage = null;
        try {
            probe.call();
        } catch (Exception e) {
            status = "DOWN";
            errorMessage = e.getMessage();
            log.warn("MCP health check failed for {} {}: {}", targetType, targetId, errorMessage);
        }
        long latencyMs = Duration.ofNanos(System.nanoTime() - startNanos).toMillis();
        healthCheckRepository.save(McpHealthCheckEntity.builder()
                .tenantId(tenantId)
                .targetType(targetType)
                .targetId(targetId)
                .status(status)
                .latencyMs(latencyMs)
                .errorMessage(errorMessage)
                .checkedAt(Instant.now())
                .build());
    }
}
