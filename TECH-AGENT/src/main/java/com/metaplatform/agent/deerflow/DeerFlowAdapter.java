package com.metaplatform.agent.deerflow;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.*;

/**
 * DeerFlow Adapter（P3.1.1）。
 *
 * <p>封装 DeerFlow Gateway HTTP API，让 TECH-AGENT 通过 Java 直接驱动 DeerFlow
 * 的 Run / SSE / Artifact。DeerFlow 内部仍用 LangGraph 运行 Agent Runtime，
 * 但 Adapter 统一了 MetaPlatform 的 Ontology Context / RunEvent / Evidence 协议。</p>
 *
 * <p>DeerFlow Gateway API：</p>
 * <ul>
 *   <li>POST /api/threads/{thread_id}/runs — 创建 Run</li>
 *   <li>POST /api/threads/{thread_id}/runs/stream — SSE 流</li>
 *   <li>GET  /api/runs/{run_id} — 状态</li>
 *   <li>POST /api/threads/{thread_id}/runs/{run_id}/cancel — 取消</li>
 *   <li>GET  /api/runs/{run_id}/artifact/{name} — Artifact</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeerFlowAdapter {

    @Value("${mate.deerflow.base-url:http://localhost:8001}")
    private String deerflowBaseUrl;

    @Value("${mate.deerflow.api-key:dev-placeholder}")
    private String apiKey;

    /**
     * 启动 DeerFlow Run。
     */
    public String startRun(StartRunRequest request) {
        log.info("[DeerFlowAdapter] startRun tenant={} agent={} thread={}",
                request.tenantId, request.agentId, request.threadId);
        try {
            RestClient client = RestClient.builder().baseUrl(deerflowBaseUrl).build();
            Map<String, Object> resp = client.post()
                    .uri("/api/threads/{tid}/runs", request.threadId)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("X-Tenant-Id", request.tenantId)
                    .header("X-User-Id", request.userId)
                    .body(toPayload(request))
                    .retrieve()
                    .body(Map.class);
            return resp == null ? null : String.valueOf(resp.get("run_id"));
        } catch (Exception e) {
            log.warn("[DeerFlowAdapter] startRun failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 取消 Run。
     */
    public boolean cancelRun(String threadId, String runId) {
        try {
            RestClient client = RestClient.builder().baseUrl(deerflowBaseUrl).build();
            client.post()
                    .uri("/api/threads/{tid}/runs/{rid}/cancel", threadId, runId)
                    .header("Authorization", "Bearer " + apiKey)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception e) {
            log.warn("[DeerFlowAdapter] cancelRun failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 获取 Run 状态。
     */
    public Map<String, Object> getRunStatus(String runId) {
        try {
            RestClient client = RestClient.builder().baseUrl(deerflowBaseUrl).build();
            return client.get()
                    .uri("/api/runs/{rid}", runId)
                    .header("Authorization", "Bearer " + apiKey)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.warn("[DeerFlowAdapter] getRunStatus failed: {}", e.getMessage());
            return Map.of("status", "UNKNOWN");
        }
    }

    /**
     * 获取 Artifact URL。
     */
    public String getArtifactUrl(String runId, String name) {
        return deerflowBaseUrl + "/api/runs/" + runId + "/artifact/" + name;
    }

    private Map<String, Object> toPayload(StartRunRequest req) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("assistant_id", req.agentId);
        body.put("input", Map.of("messages", List.of(Map.of("role", "user", "content", req.message))));
        body.put("config", Map.of(
                "configurable", Map.of(
                        "tenant_id", req.tenantId,
                        "user_id", req.userId,
                        "ontology_envelope", req.ontologyEnvelope,
                        "allowed_tools", req.allowedTools
                )
        ));
        body.put("stream_mode", "events");
        return body;
    }

    /**
     * 入参。
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class StartRunRequest {
        private String tenantId;
        private String userId;
        private String agentId;
        private String threadId;
        private String message;
        private Map<String, Object> ontologyEnvelope;
        private java.util.List<String> allowedTools;
    }
}
