package com.metaplatform.agent.common;

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
 * <p>从请求头提取 {@code X-Tenant-Id} / {@code X-Trace-Id} 并注入到 {@link TenantContext}，
 * 在请求结束时清理 ThreadLocal，防止线程复用导致的上下文串号。</p>
 *
 * <p>优先级最高（HIGHEST_PRECEDENCE + 10），确保后续所有过滤器与 Controller 都能读到上下文。</p>
 *
 * <p>JWT 解析与 userId 注入不在此处处理（避免与 Security Filter 顺序耦合），
 * 由上层 IAM / JWT 过滤器解析后调用 {@link TenantContext#setUserId(String)}。</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TraceFilter extends OncePerRequestFilter {

    public static final String HEADER_TENANT_ID = "X-Tenant-Id";
    public static final String HEADER_TRACE_ID = "X-Trace-Id";
    public static final String HEADER_USER_ID = "X-User-Id";

    /** 缺省租户（用于未携带 X-Tenant-Id 的内部调用）。 */
    public static final String DEFAULT_TENANT_ID = "tenant-default";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            // 租户 ID：优先请求头，缺失则用默认值
            String tenantId = request.getHeader(HEADER_TENANT_ID);
            if (tenantId == null || tenantId.isBlank()) {
                tenantId = DEFAULT_TENANT_ID;
            }
            TenantContext.setTenantId(tenantId);

            // 用户 ID：可选，由网关或上游 JWT 过滤器注入
            String userId = request.getHeader(HEADER_USER_ID);
            if (userId != null && !userId.isBlank()) {
                TenantContext.setUserId(userId);
            }

            // Trace ID：优先复用上游传入的，缺失则生成一个新的
            String traceId = request.getHeader(HEADER_TRACE_ID);
            if (traceId == null || traceId.isBlank()) {
                traceId = UUID.randomUUID().toString().replace("-", "");
            }
            TenantContext.setTraceId(traceId);

            // 回写响应头，便于前端/网关关联
            response.setHeader(HEADER_TRACE_ID, traceId);
            response.setHeader(HEADER_TENANT_ID, tenantId);

            filterChain.doFilter(request, response);
        } finally {
            // 必须清理，防止线程复用（Tomcat 线程池 / 虚拟线程均适用）
            TenantContext.clear();
        }
    }
}
