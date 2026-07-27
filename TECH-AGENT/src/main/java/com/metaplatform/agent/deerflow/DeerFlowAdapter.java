package com.metaplatform.agent.deerflow;

import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.*;

/** Typed client for the pinned DeerFlow Gateway contract. */
@Slf4j
@Component
public class DeerFlowAdapter {
    private final DeerFlowProperties properties;
    private final RestClient client;

    public DeerFlowAdapter() { this(new DeerFlowProperties()); }

    @Autowired
    public DeerFlowAdapter(DeerFlowProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties");
        Duration timeout = properties.getRequestTimeout() == null ? Duration.ofSeconds(30) : properties.getRequestTimeout();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);
        this.client = RestClient.builder().baseUrl(stripTrailingSlash(properties.getGatewayUrl())).requestFactory(factory).build();
    }

    public String startRun(StartRunRequest request) {
        if (!properties.isEnabled()) throw DeerFlowException.disabled();
        if (request == null || request.getThreadId() == null || request.getThreadId().isBlank()) {
            throw new DeerFlowException("DEERFLOW_INVALID_REQUEST", "threadId is required", 400, null);
        }
        Map<String,Object> payload = toPayload(request);
        try {
            ensureThread(request);
            Map<?,?> response = client.post().uri("/threads/{tid}/runs", request.getThreadId())
                    .headers(h -> addIdentityHeaders(h, request))
                    .body(payload).retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req,res) -> { throw upstream("DEERFLOW_UPSTREAM_4XX", res); })
                    .onStatus(HttpStatusCode::is5xxServerError, (req,res) -> { throw upstream("DEERFLOW_UPSTREAM_5XX", res); })
                    .body(Map.class);
            String runId = response == null ? null : Objects.toString(response.get("run_id"), null);
            if (runId == null || runId.isBlank()) throw new DeerFlowException("DEERFLOW_INVALID_RESPONSE", "Gateway returned no run_id", 502, null);
            return runId;
        } catch (DeerFlowException e) { throw e; }
        catch (Exception e) { throw new DeerFlowException("DEERFLOW_UNAVAILABLE", "Gateway request failed", null, e); }
    }

    private void ensureThread(StartRunRequest request) {
        try {
            client.post().uri("/threads").headers(h -> addIdentityHeaders(h, request))
                    .body(Map.of("thread_id", request.getThreadId(), "assistant_id", request.getAgentId(),
                            "metadata", Map.of("tenant_id", Objects.toString(request.getTenantId(), ""),
                                    "platform_run_id", Objects.toString(request.getPlatformRunId(), ""))))
                    .retrieve()
                    .onStatus(status -> status.value() == 409, (req, res) -> { /* already exists */ })
                    .toBodilessEntity();
        } catch (Exception e) {
            // Gateway's create endpoint is idempotent for an existing thread; a 404/5xx is
            // a real dependency error and must not degrade into a null upstream run id.
            if (e instanceof DeerFlowException de && de.getStatus() != null && de.getStatus() == 409) return;
            throw new DeerFlowException("DEERFLOW_THREAD_CREATE_FAILED", "Unable to create DeerFlow thread", null, e);
        }
    }

    public Map<String,Object> getRunStatus(String threadId, String runId) {
        if (!properties.isEnabled()) throw DeerFlowException.disabled();
        try {
            Map<?,?> response = client.get().uri("/threads/{tid}/runs/{rid}", threadId, runId)
                    .headers(h -> addIdentityHeaders(h, null)).retrieve().body(Map.class);
            return response == null ? Map.of() : new LinkedHashMap<>((Map<String,Object>) response);
        } catch (Exception e) { throw new DeerFlowException("DEERFLOW_STATUS_UNAVAILABLE", "Gateway status request failed", null, e); }
    }

    public boolean cancelRun(String threadId, String runId) {
        if (!properties.isEnabled()) throw DeerFlowException.disabled();
        try { client.post().uri("/threads/{tid}/runs/{rid}/cancel", threadId, runId).headers(h -> addIdentityHeaders(h, null)).retrieve().toBodilessEntity(); return true; }
        catch (Exception e) { throw new DeerFlowException("DEERFLOW_CANCEL_FAILED", "Gateway cancellation failed", null, e); }
    }

    public String getArtifactUrl(String threadId, String path) { return stripTrailingSlash(properties.getGatewayUrl()) + "/threads/" + threadId + "/artifacts/" + path; }

    private Map<String,Object> toPayload(StartRunRequest req) {
        Map<String,Object> body = new LinkedHashMap<>();
        body.put("assistant_id", req.getAgentId());
        body.put("input", Map.of("messages", List.of(Map.of("role", "user", "content", Objects.toString(req.getMessage(), "")) )));
        body.put("config", Map.of("configurable", Map.of("tenant_id", Objects.toString(req.getTenantId(), ""), "user_id", Objects.toString(req.getUserId(), ""), "ontology_envelope", Optional.ofNullable(req.getOntologyEnvelope()).orElse(Map.of()), "allowed_tools", Optional.ofNullable(req.getAllowedTools()).orElse(List.of()))));
        body.put("metadata", Map.of("platform_run_id", Objects.toString(req.getPlatformRunId(), ""), "tenant_id", Objects.toString(req.getTenantId(), ""), "trace_id", Objects.toString(req.getTraceId(), "")));
        body.put("stream_mode", "updates"); body.put("on_disconnect", "continue"); body.put("if_not_exists", "create");
        return body;
    }

    private void addIdentityHeaders(org.springframework.http.HttpHeaders h, StartRunRequest request) {
        if (properties.getInternalToken() != null && !properties.getInternalToken().isBlank()) h.set("X-DeerFlow-Internal-Token", properties.getInternalToken());
        String owner = properties.getOwnerUserId();
        if (owner != null && !owner.isBlank()) h.set("X-DeerFlow-Owner-User-Id", owner);
    }
    private static DeerFlowException upstream(String code, org.springframework.http.client.ClientHttpResponse res) {
        try {
            String detail = new String(res.getBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            return new DeerFlowException(code, "DeerFlow returned " + res.getStatusCode() + ": " + detail, res.getStatusCode().value(), null);
        } catch (Exception e) { return new DeerFlowException(code, "DeerFlow upstream error", null, e); }
    }
    private static String stripTrailingSlash(String value) { return value == null || value.isBlank() ? "http://localhost:2026/api" : value.replaceAll("/+$", ""); }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class StartRunRequest {
        private String tenantId, userId, agentId, threadId, message, platformRunId, traceId;
        private Map<String,Object> ontologyEnvelope;
        private List<String> allowedTools;
    }
}
