package com.metaplatform.a2a.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 链路与租户上下文过滤器。
 *
 * <p>对应 Python {@code app.common.middleware.install_trace_id_middleware}。
 * 从请求头提取 {@code X-Tenant-Id} / {@code X-Trace-Id} 并注入到 {@link TenantContext}，
 * 在请求结束时清理 ThreadLocal。</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TraceFilter extends OncePerRequestFilter {

    public static final String HEADER_TENANT_ID = "X-Tenant-Id";
    public static final String HEADER_TRACE_ID = "X-Trace-Id";
    public static final String HEADER_USER_ID = "X-User-Id";

    public static final String DEFAULT_TENANT_ID = "tenant-default";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String tenantId = request.getHeader(HEADER_TENANT_ID);
            if (tenantId == null || tenantId.isBlank()) {
                tenantId = DEFAULT_TENANT_ID;
            }
            TenantContext.setTenantId(tenantId);

            String userId = request.getHeader(HEADER_USER_ID);
            if (userId != null && !userId.isBlank()) {
                TenantContext.setUserId(userId);
            }

            String traceId = request.getHeader(HEADER_TRACE_ID);
            if (traceId == null || traceId.isBlank()) {
                traceId = UUID.randomUUID().toString().replace("-", "");
            }
            TenantContext.setTraceId(traceId);

            response.setHeader(HEADER_TRACE_ID, traceId);
            response.setHeader(HEADER_TENANT_ID, tenantId);

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
