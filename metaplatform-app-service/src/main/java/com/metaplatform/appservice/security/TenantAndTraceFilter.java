package com.metaplatform.appservice.security;

import com.metaplatform.appservice.config.AppServiceProperties;
import com.metaplatform.appservice.security.TenantContext;
import com.metaplatform.appservice.domain.audit.AuditLog;
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
import java.util.UUID;

/**
 * 跨请求统一注入 traceId + tenant，Sprint 0 期间 auth.mode=dev 时放行所有请求并默认赋予 admin 角色。
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

        try {
            chain.doFilter(req, res);
        } finally {
            TenantContext.clear();
            MDC.clear();
        }
    }
}
