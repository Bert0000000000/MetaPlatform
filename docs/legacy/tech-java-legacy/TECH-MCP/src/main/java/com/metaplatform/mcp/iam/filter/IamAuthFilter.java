package com.metaplatform.mcp.iam.filter;

import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.common.TraceContext;
import com.metaplatform.mcp.config.McpIamProperties;
import com.metaplatform.mcp.iam.entity.McpApiKeyEntity;
import com.metaplatform.mcp.iam.repository.McpApiKeyRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * IAM 鉴权过滤器：
 * 1) iam.enabled=false → 放行（保留 TenantContext / TraceContext 透传）
 * 2) iam.enabled=true：
 *    - X-API-Key 头 → McpApiKeyRepository 查询 + BCrypt 校验 hash
 *    - Authorization: Bearer → 通过 WebClient 调 IAM /oauth2/introspect 校验
 *    - 都没匹配 → 返回 401
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IamAuthFilter extends OncePerRequestFilter {

    private static final String AUTH_BEARER_PREFIX = "Bearer ";
    private static final String INTROSPECT_PATH = "/oauth2/introspect";

    private final McpIamProperties iamProperties;
    private final McpApiKeyRepository apiKeyRepository;
    private final WebClient.Builder webClientBuilder;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean iamEnabled = iamProperties.isEnabled();
        String apiKeyHeader = iamProperties.getApiKeyHeader();

        String apiKeyValue = request.getHeader(apiKeyHeader);
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        boolean authenticated = false;

        if (apiKeyValue != null && !apiKeyValue.isBlank()) {
            authenticated = authenticateByApiKey(apiKeyValue, request);
        } else if (authHeader != null && authHeader.startsWith(AUTH_BEARER_PREFIX)) {
            String token = authHeader.substring(AUTH_BEARER_PREFIX.length()).trim();
            authenticated = authenticateByBearer(token);
        }

        if (iamEnabled && !authenticated) {
            String traceId = TraceContext.getOrCreate();
            log.warn("IAM auth rejected, path={}, remoteAddr={}, traceId={}",
                    request.getRequestURI(), request.getRemoteAddr(), traceId);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"code\":40101,\"message\":\"未认证\",\"traceId\":\"" + traceId + "\"}"
            );
            return;
        }

        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private boolean authenticateByApiKey(String apiKey, HttpServletRequest request) {
        try {
            int dot = apiKey.indexOf(':');
            if (dot <= 0 || dot >= apiKey.length() - 1) {
                log.debug("apiKey format invalid (expect keyId:secret)");
                return false;
            }
            String keyId = apiKey.substring(0, dot);
            String secret = apiKey.substring(dot + 1);

            Optional<McpApiKeyEntity> opt = apiKeyRepository.findByTenantIdAndKeyId(
                    TenantContext.DEFAULT_TENANT_ID, keyId);
            if (opt.isEmpty()) {
                log.debug("apiKey not found, keyId={}", keyId);
                return false;
            }
            McpApiKeyEntity entity = opt.get();
            if (Boolean.FALSE.equals(entity.getEnabled()) || !"ACTIVE".equalsIgnoreCase(entity.getStatus())) {
                log.debug("apiKey disabled or inactive, keyId={}", keyId);
                return false;
            }
            if (entity.getExpiresAt() != null && Instant.now().isAfter(entity.getExpiresAt())) {
                log.debug("apiKey expired, keyId={}", keyId);
                return false;
            }
            if (!BCrypt.checkpw(secret, entity.getKeyHash())) {
                log.debug("apiKey hash mismatch, keyId={}", keyId);
                return false;
            }

            TenantContext.set(entity.getTenantId());
            TraceContext.setUserId("apiKey:" + keyId);
            entity.setLastUsedAt(Instant.now());
            try {
                apiKeyRepository.save(entity);
            } catch (Exception ignored) {
                // 异步失败不影响请求链路
            }
            return true;
        } catch (Exception e) {
            log.warn("apiKey auth exception: {}", e.getMessage());
            return false;
        }
    }

    private boolean authenticateByBearer(String token) {
        try {
            String baseUrl = Optional.ofNullable(iamProperties.getBaseUrl())
                    .map(s -> s.endsWith("/") ? s.substring(0, s.length() - 1) : s)
                    .orElse("http://localhost:8101");
            String url = baseUrl + INTROSPECT_PATH;
            @SuppressWarnings("unchecked")
            Map<String, Object> resp = webClientBuilder.build()
                    .post()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, AUTH_BEARER_PREFIX + token)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(3))
                    .block();
            if (resp == null || !Boolean.TRUE.equals(resp.get("active"))) {
                log.debug("bearer token introspect inactive");
                return false;
            }
            Object tenantId = resp.get("tenant_id");
            Object userId = resp.get("user_id");
            Object scopes = resp.get("scope");
            if (tenantId != null) {
                TenantContext.set(tenantId.toString());
            } else {
                TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
            }
            if (userId != null) {
                TraceContext.setUserId(userId.toString());
            }
            log.debug("bearer token accepted, scopes={}", scopes);
            return true;
        } catch (Exception e) {
            log.warn("bearer introspect failed: {}", e.getMessage());
            return false;
        }
    }
}