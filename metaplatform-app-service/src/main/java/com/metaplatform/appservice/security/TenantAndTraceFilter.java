package com.metaplatform.appservice.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.appservice.config.AppServiceProperties;
import com.metaplatform.appservice.domain.audit.AuditLogRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * 跨请求统一注入 traceId + tenant + user，Sprint 0 期间 auth.mode=dev 时放行所有请求并默认赋予 admin 角色。
 *
 * <p>本类与 ontology-engine 的 {@code TenantFilter} / {@code TraceIdFilter} 思路一致：
 * 通过 MDC 注入日志上下文，把 traceId 写回响应头，便于全链路追踪。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TenantAndTraceFilter extends OncePerRequestFilter {

    public static final String TRACE_HEADER = "X-Trace-Id";
    public static final String TENANT_HEADER = "X-Tenant-Id";

    private final AppServiceProperties props;
    private final AuditLogRepository auditRepo;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TenantAndTraceFilter(AppServiceProperties props, AuditLogRepository auditRepo) {
        this.props = props;
        this.auditRepo = auditRepo;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String traceId = req.getHeader(TRACE_HEADER);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
        }
        MDC.put("traceId", traceId);
        res.setHeader(TRACE_HEADER, traceId);

        String tenantId = req.getHeader(TENANT_HEADER);
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = props.defaultTenant();
        }
        TenantContext.set(tenantId);
        MDC.put("tenant", tenantId);

        // 解析 JWT payload 中的用户和角色（不校验签名，仅用于业务层权限判断）
        parseUserFromJwt(req);

        try {
            chain.doFilter(req, res);
        } finally {
            TenantContext.clear();
            MDC.clear();
        }
    }

    private void parseUserFromJwt(HttpServletRequest req) {
        String auth = req.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            // dev 模式默认用户
            TenantContext.setUser("dev-user", List.of("admin"));
            return;
        }
        try {
            String payload = auth.substring(7).split("\\.")[1];
            String json = new String(Base64.getUrlDecoder().decode(payload));
            JsonNode node = objectMapper.readTree(json);
            String userId = node.path("sub").asText("dev-user");
            List<String> roles = Collections.emptyList();
            if (node.has("roles") && node.get("roles").isArray()) {
                roles = objectMapper.readerForListOf(String.class).readValue(node.get("roles"));
            }
            TenantContext.setUser(userId, roles);
        } catch (Exception e) {
            TenantContext.setUser("dev-user", List.of("admin"));
        }
    }
}
